import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { CREDIT_PACKS, SUBSCRIPTION_CREDITS, type CreditPackKey } from "../config/constants.js";
import { PaymentError, ValidationError } from "../errors/index.js";
import { creditCredits } from "./credit.service.js";
import type { CreditPurchaseRequest, CheckoutResponse } from "../types/index.js";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) throw new PaymentError("Stripe is not configured");
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

// ─── Create Credit Purchase Checkout ─────────────────

export async function createCreditCheckout(
  userId: string,
  body: CreditPurchaseRequest,
): Promise<CheckoutResponse> {
  const pack = CREDIT_PACKS[body.packSize as CreditPackKey];
  if (!pack) {
    throw new ValidationError(`Invalid pack size: ${body.packSize}`);
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      currency: "aed",
      line_items: [
        {
          price_data: {
            currency: "aed",
            product_data: {
              name: `${pack.credits} Credits`,
              description: `Sahm سهم — ${pack.credits} generation credits`,
            },
            unit_amount: pack.priceAed,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        purchaseType: "CREDIT_PACK",
        packSize: body.packSize,
        credits: String(pack.credits),
      },
      success_url: `${env.FRONTEND_URL}/credits?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/credits`,
    });

    if (!session.url) {
      throw new PaymentError("Failed to create checkout session URL");
    }

    return { sessionId: session.id, url: session.url };
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    throw new PaymentError(
      "Failed to create Stripe checkout session",
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

// ─── Handle Webhook ──────────────────────────────────

export async function handleWebhook(
  prisma: PrismaClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(prisma, session);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(prisma, invoice);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(prisma, subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(prisma, subscription);
      break;
    }

    default:
      break;
  }
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}

// ─── Webhook Handlers ────────────────────────────────

async function handleCheckoutCompleted(
  prisma: PrismaClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { userId, purchaseType, credits } = session.metadata || {};

  if (!userId || purchaseType !== "CREDIT_PACK" || !credits) return;

  const creditAmount = parseInt(credits, 10);
  if (isNaN(creditAmount) || creditAmount <= 0) return;

  await creditCredits(
    prisma,
    userId,
    creditAmount,
    "PURCHASE",
    session.payment_intent as string,
    `Purchased ${creditAmount} credits`,
  );
}

async function handleInvoicePaid(
  prisma: PrismaClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = invoice.subscription_details?.metadata?.userId;
  if (!userId) return;

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) return;

  const monthlyCredits =
    SUBSCRIPTION_CREDITS[subscription.plan as keyof typeof SUBSCRIPTION_CREDITS] || 0;

  if (monthlyCredits > 0) {
    await creditCredits(
      prisma,
      userId,
      monthlyCredits,
      "SUBSCRIPTION",
      undefined,
      `Monthly ${subscription.plan} credits`,
    );
  }
}

async function handleSubscriptionUpdated(
  prisma: PrismaClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const plan = (subscription.metadata?.plan as string) || "STARTER";
  const monthlyCredits =
    SUBSCRIPTION_CREDITS[plan as keyof typeof SUBSCRIPTION_CREDITS] || 0;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeSubId: subscription.id,
      status: subscription.status,
      plan: plan as "FREE" | "STARTER" | "PRO" | "UNLIMITED",
      monthlyCredits,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    create: {
      userId,
      plan: plan as "FREE" | "STARTER" | "PRO" | "UNLIMITED",
      stripeCustomerId: subscription.customer as string,
      stripeSubId: subscription.id,
      status: subscription.status,
      monthlyCredits,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(
  prisma: PrismaClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await prisma.subscription.updateMany({
    where: { stripeSubId: subscription.id },
    data: { status: "canceled", plan: "FREE", monthlyCredits: 0 },
  });
}

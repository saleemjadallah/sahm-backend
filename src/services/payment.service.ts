import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_CREDITS,
  SUBSCRIPTION_PLANS,
  type CreditPackKey,
  type SubscriptionPlanKey,
} from "../config/constants.js";
import { PaymentError, ValidationError } from "../errors/index.js";
import { creditCredits } from "./credit.service.js";
import { trackPurchase } from "../lib/meta/capi.js";
import type {
  CheckoutResponse,
  CreditPurchaseRequest,
  SubscriptionCheckoutRequest,
} from "../types/index.js";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) throw new PaymentError("Stripe is not configured");
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

function normalizeCheckoutReturnPath(returnPath?: string): string {
  if (!returnPath) return "/credits";
  if (!returnPath.startsWith("/") || returnPath.startsWith("//")) return "/credits";
  return returnPath;
}

function appendQueryParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function buildSuccessUrl(
  returnPath: string,
  params: Record<string, string>,
): string {
  let nextPath = appendQueryParam(returnPath, "checkout", "success");

  Object.entries(params).forEach(([key, value]) => {
    nextPath = appendQueryParam(nextPath, key, value);
  });

  return appendQueryParam(nextPath, "session_id", "{CHECKOUT_SESSION_ID}");
}

function isSubscriptionPlan(plan: string): plan is SubscriptionPlanKey {
  return plan in SUBSCRIPTION_PLANS;
}

const SUBSCRIPTION_PRICE_IDS: Record<SubscriptionPlanKey, string> = {
  STARTER: env.STRIPE_SUB_STARTER_PRICE_ID,
  PRO: env.STRIPE_SUB_PRO_PRICE_ID,
  UNLIMITED: env.STRIPE_SUB_UNLIMITED_PRICE_ID,
};

const MANAGED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

// ─── Create Credit Purchase Checkout ─────────────────

export async function createCreditCheckout(
  userId: string,
  body: CreditPurchaseRequest,
): Promise<CheckoutResponse> {
  const pack = CREDIT_PACKS[body.packSize as CreditPackKey];
  if (!pack) {
    throw new ValidationError(`Invalid pack size: ${body.packSize}`);
  }

  const returnPath = normalizeCheckoutReturnPath(body.returnPath);
  const successUrl = buildSuccessUrl(returnPath, { billing: "credits" });

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
      success_url: `${env.FRONTEND_URL}${successUrl}`,
      cancel_url: `${env.FRONTEND_URL}${returnPath}`,
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

export async function createSubscriptionCheckout(
  prisma: PrismaClient,
  userId: string,
  userEmail: string,
  body: SubscriptionCheckoutRequest,
): Promise<CheckoutResponse> {
  if (!isSubscriptionPlan(body.plan)) {
    throw new ValidationError(`Invalid subscription plan: ${body.plan}`);
  }

  const returnPath = normalizeCheckoutReturnPath(body.returnPath || "/pricing");
  const successUrl = buildSuccessUrl(returnPath, {
    billing: "subscription",
    plan: body.plan.toLowerCase(),
  });

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (
    existingSubscription?.stripeCustomerId
    && MANAGED_SUBSCRIPTION_STATUSES.has(existingSubscription.status)
  ) {
    return createBillingPortalSession(existingSubscription.stripeCustomerId, returnPath);
  }

  const planConfig = SUBSCRIPTION_PLANS[body.plan];
  const configuredPriceId = SUBSCRIPTION_PRICE_IDS[body.plan];

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: userId,
      line_items: [
        configuredPriceId
          ? {
              price: configuredPriceId,
              quantity: 1,
            }
          : {
              price_data: {
                currency: "aed",
                unit_amount: planConfig.priceAed,
                recurring: { interval: "month" },
                product_data: {
                  name: `Sahm ${planConfig.label}`,
                  description:
                    planConfig.monthlyCredits >= 999999
                      ? "Sahm سهم — unlimited export subscription"
                      : `Sahm سهم — ${planConfig.monthlyCredits} monthly credits`,
                },
              },
              quantity: 1,
            },
      ],
      ...(existingSubscription?.stripeCustomerId
        ? { customer: existingSubscription.stripeCustomerId }
        : { customer_email: userEmail }),
      metadata: {
        userId,
        purchaseType: "SUBSCRIPTION",
        plan: body.plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan: body.plan,
        },
      },
      success_url: `${env.FRONTEND_URL}${successUrl}`,
      cancel_url: `${env.FRONTEND_URL}${returnPath}`,
    });

    if (!session.url) {
      throw new PaymentError("Failed to create subscription checkout session URL");
    }

    return {
      sessionId: session.id,
      url: session.url,
      mode: "subscription_checkout",
    };
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    throw new PaymentError(
      "Failed to create Stripe subscription session",
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnPath = "/pricing",
): Promise<CheckoutResponse> {
  const safeReturnPath = normalizeCheckoutReturnPath(returnPath);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${env.FRONTEND_URL}${safeReturnPath}`,
    });

    return {
      sessionId: session.id,
      url: session.url,
      mode: "billing_portal",
    };
  } catch (err) {
    throw new PaymentError(
      "Failed to create Stripe billing portal session",
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
  const { userId, purchaseType, credits, packSize } = session.metadata || {};

  if (!userId || purchaseType !== "CREDIT_PACK" || !credits) return;

  const paymentIntentId = session.payment_intent as string | null;
  if (!paymentIntentId) return;

  const existingPurchase = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      type: "PURCHASE",
      stripePaymentId: paymentIntentId,
    },
  });

  if (existingPurchase) {
    return;
  }

  const creditAmount = parseInt(credits, 10);
  if (isNaN(creditAmount) || creditAmount <= 0) return;

  await creditCredits(
    prisma,
    userId,
    creditAmount,
    "PURCHASE",
    paymentIntentId,
    `Purchased ${creditAmount} credits`,
  );

  // Fire Meta CAPI Purchase event
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user) {
    const pack = packSize ? CREDIT_PACKS[packSize as CreditPackKey] : undefined;
    trackPurchase({
      email: user.email,
      userId,
      currency: "AED",
      value: pack ? pack.priceAed / 100 : (session.amount_total ?? 0) / 100,
      contentName: `${creditAmount} Credits`,
      transactionId: paymentIntentId,
    });
  }
}

async function handleInvoicePaid(
  prisma: PrismaClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = invoice.subscription_details?.metadata?.userId;
  if (!userId) return;

  const rawPlan = invoice.subscription_details?.metadata?.plan;
  const plan: SubscriptionPlanKey = isSubscriptionPlan(rawPlan || "")
    ? rawPlan as SubscriptionPlanKey
    : "STARTER";
  const monthlyCredits = SUBSCRIPTION_CREDITS[plan] || 0;
  const stripeSubscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  const currentPeriodEndUnix = invoice.lines.data[0]?.period?.end;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      status: "active",
      monthlyCredits,
      stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : undefined,
      stripeSubId: stripeSubscriptionId ?? undefined,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : undefined,
    },
    create: {
      userId,
      plan,
      status: "active",
      monthlyCredits,
      stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
      stripeSubId: stripeSubscriptionId,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null,
    },
  });

  if (monthlyCredits > 0) {
    await creditCredits(
      prisma,
      userId,
      monthlyCredits,
      "SUBSCRIPTION",
      invoice.id,
      `Monthly ${plan} credits`,
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
      stripeCustomerId: subscription.customer as string,
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
    data: {
      status: "canceled",
      plan: "FREE",
      monthlyCredits: 0,
      currentPeriodEnd: null,
    },
  });
}

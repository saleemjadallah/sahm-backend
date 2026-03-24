import Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { PRICING } from "../config/constants.js";
import { NotFoundError, PaymentError, ValidationError } from "../errors/index.js";
import type { CheckoutRequest, CheckoutResponse } from "../types/index.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

// ─── Pricing Map ───────────────────────────────────────

const PURCHASE_PRICING: Record<string, { amount: number; label: string; purchaseType: string }> = {
  SINGLE_DESIGN: {
    amount: PRICING.SINGLE_DESIGN,
    label: "Single Design Download",
    purchaseType: "SINGLE_DESIGN",
  },
  SUITE: {
    amount: PRICING.WEDDING_SUITE,
    label: "Wedding Stationery Suite",
    purchaseType: "SUITE",
  },
  SUITE_RSVP: {
    amount: PRICING.WEDDING_SUITE_RSVP,
    label: "Wedding Suite + RSVP",
    purchaseType: "SUITE",
  },
  BABY_SET: {
    amount: PRICING.BABY_SET,
    label: "Baby Announcement Set",
    purchaseType: "SUITE",
  },
  BABY_JOURNEY: {
    amount: PRICING.BABY_JOURNEY,
    label: "Baby Full Journey",
    purchaseType: "SUITE",
  },
  CREDIT_PACK_10: {
    amount: PRICING.CREDIT_PACK_10,
    label: "10 Download Credits",
    purchaseType: "CREDIT_PACK",
  },
  CREDIT_PACK_30: {
    amount: PRICING.CREDIT_PACK_30,
    label: "30 Download Credits",
    purchaseType: "CREDIT_PACK",
  },
};

// ─── Create Checkout Session ───────────────────────────

/**
 * Create a Stripe Checkout session for a purchase in AED.
 */
export async function createCheckoutSession(
  prisma: PrismaClient,
  userId: string,
  body: CheckoutRequest,
): Promise<CheckoutResponse> {
  const { projectId, purchaseType, designId } = body;

  // Validate project exists and belongs to user
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  const pricing = PURCHASE_PRICING[purchaseType];
  if (!pricing) {
    throw new ValidationError(`Invalid purchase type: ${purchaseType}`);
  }

  // For single design, validate the design exists
  if (purchaseType === "SINGLE_DESIGN" && designId) {
    const design = await prisma.design.findFirst({
      where: { id: designId, projectId },
    });
    if (!design) {
      throw new NotFoundError("Design");
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "aed",
      line_items: [
        {
          price_data: {
            currency: "aed",
            product_data: {
              name: pricing.label,
              description: `Sahm \u0633\u0647\u0645 - ${project.title || project.type}`,
            },
            unit_amount: pricing.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        projectId,
        purchaseType,
        designId: designId || "",
        internalPurchaseType: pricing.purchaseType,
      },
      success_url: `${env.FRONTEND_URL}/projects/${projectId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/projects/${projectId}`,
    });

    if (!session.url) {
      throw new PaymentError("Failed to create checkout session URL");
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    throw new PaymentError(
      "Failed to create Stripe checkout session",
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

// ─── Handle Webhook ────────────────────────────────────

/**
 * Process Stripe webhook events.
 */
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
      // Unhandled event type — log but don't error
      break;
  }
}

/**
 * Construct and verify a Stripe webhook event from raw payload.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}

// ─── Webhook Handlers ──────────────────────────────────

async function handleCheckoutCompleted(
  prisma: PrismaClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { userId, projectId, purchaseType, designId, internalPurchaseType } =
    session.metadata || {};

  if (!userId || !projectId || !internalPurchaseType) {
    return; // Missing metadata — can't process
  }

  const amountAed = session.amount_total || 0;

  if (internalPurchaseType === "SINGLE_DESIGN" && designId) {
    // Single design purchase — create one Download record
    await prisma.download.create({
      data: {
        userId,
        designId,
        purchaseType: "SINGLE_DESIGN",
        amountAed,
        stripePaymentId: session.payment_intent as string,
      },
    });

    // Mark design as downloaded
    await prisma.design.update({
      where: { id: designId },
      data: { isDownloaded: true },
    });
  } else if (internalPurchaseType === "SUITE") {
    // Suite purchase — create Download records for all designs in the project
    const designs = await prisma.design.findMany({
      where: { projectId },
      select: { id: true },
    });

    await prisma.download.createMany({
      data: designs.map((d) => ({
        userId,
        designId: d.id,
        purchaseType: "SUITE" as const,
        amountAed: Math.round(amountAed / designs.length),
        stripePaymentId: session.payment_intent as string,
      })),
    });

    // Mark all designs as downloaded
    await prisma.design.updateMany({
      where: { projectId },
      data: { isDownloaded: true },
    });

    // If SUITE_RSVP, generate RSVP slug
    if (purchaseType === "SUITE_RSVP") {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project && !project.rsvpSlug) {
        const slug = generateRsvpSlug(project.nameEn || project.title || "event");
        await prisma.project.update({
          where: { id: projectId },
          data: { rsvpSlug: slug },
        });
      }
    }
  } else if (internalPurchaseType === "CREDIT_PACK") {
    // Credit pack — add credits to user subscription
    const credits = purchaseType === "CREDIT_PACK_30" ? 30 : 10;

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        creditsRemaining: { increment: credits },
      },
      create: {
        userId,
        plan: "FREE",
        creditsRemaining: credits,
      },
    });
  }
}

async function handleSubscriptionUpdated(
  prisma: PrismaClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeSubId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    create: {
      userId,
      plan: "STARTER",
      stripeCustomerId: subscription.customer as string,
      stripeSubId: subscription.id,
      status: subscription.status,
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
    },
  });
}

// ─── Helpers ───────────────────────────────────────────

function generateRsvpSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50)
    + "-" + nanoidShort();
}

function nanoidShort(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

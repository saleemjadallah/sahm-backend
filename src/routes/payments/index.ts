import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createBillingPortalSession,
  createSubscriptionCheckout,
} from "../../services/payment.service.js";
import type { SubscriptionCheckoutRequest } from "../../types/index.js";

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SubscriptionCheckoutRequest }>(
    "/subscriptions/checkout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await createSubscriptionCheckout(
        fastify.prisma,
        request.userId!,
        request.user!.email,
        request.body,
      );

      return reply.send({ success: true, data: result });
    },
  );

  fastify.post<{ Body: { returnPath?: string } }>(
    "/billing-portal",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const subscription = await fastify.prisma.subscription.findUnique({
        where: { userId: request.userId! },
        select: { stripeCustomerId: true },
      });

      if (!subscription?.stripeCustomerId) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "SUBSCRIPTION_NOT_FOUND",
            message: "No Stripe customer found for this user",
          },
        });
      }

      const result = await createBillingPortalSession(
        subscription.stripeCustomerId,
        request.body?.returnPath || "/pricing",
      );

      return reply.send({ success: true, data: result });
    },
  );
}

export { webhookRoute } from "./webhook.js";

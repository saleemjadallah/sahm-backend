import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { constructWebhookEvent, handleWebhook } from "../../services/payment.service.js";
import { PaymentError } from "../../errors/index.js";
import type { ApiResponse } from "../../types/index.js";

export async function webhookRoute(fastify: FastifyInstance) {
  // POST /api/payments/stripe — handle Stripe webhook events
  // Note: Stripe webhooks require the raw body for signature verification.
  // Fastify must be configured to provide rawBody for this route.
  fastify.post(
    "/stripe",
    {
      config: {
        rawBody: true,
      } as Record<string, unknown>,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers["stripe-signature"];

      if (!signature || typeof signature !== "string") {
        throw new PaymentError("Missing Stripe signature header");
      }

      // Use rawBody if available, otherwise fall back to body
      const payload = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
        || JSON.stringify(request.body);

      const event = constructWebhookEvent(payload, signature);

      await handleWebhook(fastify.prisma, event);

      const response: ApiResponse = {
        success: true,
        data: { received: true },
      };

      reply.send(response);
    },
  );
}

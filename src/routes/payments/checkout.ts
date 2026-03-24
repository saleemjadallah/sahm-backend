import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createCheckoutSession } from "../../services/payment.service.js";
import type { ApiResponse, CheckoutResponse } from "../../types/index.js";

const checkoutSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  purchaseType: z.enum([
    "SINGLE_DESIGN",
    "SUITE",
    "SUITE_RSVP",
    "BABY_SET",
    "BABY_JOURNEY",
    "CREDIT_PACK_10",
    "CREDIT_PACK_30",
  ]),
  designId: z.string().optional(),
});

export async function checkoutRoute(fastify: FastifyInstance) {
  // POST /api/payments/checkout — create a Stripe Checkout session
  fastify.post(
    "/checkout",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = checkoutSchema.parse(request.body);
      const userId = request.user!.id;

      const result = await createCheckoutSession(fastify.prisma, userId, body);

      const response: ApiResponse<CheckoutResponse> = {
        success: true,
        data: result,
      };

      reply.send(response);
    },
  );
}

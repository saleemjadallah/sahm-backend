import type { FastifyInstance } from "fastify";

// Payments now only handles the Stripe webhook.
// Credit purchases go through /api/credits/purchase.
export async function paymentRoutes(_fastify: FastifyInstance) {
  // No checkout routes needed — credit purchase is at /api/credits/purchase
}

export { webhookRoute } from "./webhook.js";

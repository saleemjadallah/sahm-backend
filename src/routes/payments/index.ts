import type { FastifyInstance } from "fastify";
import { checkoutRoute } from "./checkout.js";

export async function paymentRoutes(fastify: FastifyInstance) {
  // POST /api/payments/checkout — Create Stripe Checkout session
  await fastify.register(checkoutRoute);
}

// Webhook route is exported separately — registered under /api/webhooks in server.ts
export { webhookRoute } from "./webhook.js";

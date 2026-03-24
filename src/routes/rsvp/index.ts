import type { FastifyInstance } from "fastify";
import { publicPageRoute } from "./public-page.js";
import { respondRoute } from "./respond.js";

export async function rsvpRoutes(fastify: FastifyInstance) {
  // GET /api/rsvp/:slug — Public RSVP page data
  await fastify.register(publicPageRoute);

  // POST /api/rsvp/:slug/respond — Submit RSVP response
  await fastify.register(respondRoute);
}

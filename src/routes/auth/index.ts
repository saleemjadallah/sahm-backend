import type { FastifyInstance } from "fastify";
import { magicLinkRoutes } from "./magic-link.js";
import { googleAuthRoutes } from "./google.js";
import { meRoutes } from "./me.js";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(magicLinkRoutes);
  await fastify.register(googleAuthRoutes);
  await fastify.register(meRoutes);
}

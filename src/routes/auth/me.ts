import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /me — return the current authenticated user
  fastify.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    return reply.status(200).send({
      success: true,
      data: { user: request.user },
    });
  });
}

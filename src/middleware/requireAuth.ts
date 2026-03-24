import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../errors/index.js";

/**
 * Simple preHandler that returns 401 if no authenticated user is on the request.
 * Use this on routes that require authentication.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError("Authentication required");
  }
}

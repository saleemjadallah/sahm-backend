import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../errors/index.js";

/**
 * Simple preHandler that returns 401 if no authenticated user is on the request.
 * Sets request.userId as a convenience shortcut.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError("Authentication required");
  }
  request.userId = request.user.id;
}

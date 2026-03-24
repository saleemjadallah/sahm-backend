import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors/index.js";
import type { JwtPayload, AuthUser } from "../types/index.js";

/**
 * Middleware to extract and verify JWT from the Authorization header.
 * Attaches the user to the request if the token is valid.
 * Does NOT reject the request if no token is present — use requireAuth for that.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    request.user = undefined;
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    request.user = user as AuthUser;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    // Token is invalid or expired
    request.user = undefined;
  }
}

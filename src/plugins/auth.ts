import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload, AuthUser } from "../types/index.js";

async function authPlugin(fastify: FastifyInstance) {
  async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      request.user = undefined;
      return;
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      const user = await fastify.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
        },
      });

      if (user) {
        request.user = user as AuthUser;
      }
    } catch {
      // Token invalid or expired — user remains undefined
      request.user = undefined;
    }
  }

  fastify.decorate("authenticate", authenticate);

  // Add authenticate as a preHandler to parse JWT on every request (optional)
  fastify.addHook("preHandler", authenticate);
}

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["prisma"],
});

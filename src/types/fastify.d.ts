import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "./index.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthUser;
  }
}

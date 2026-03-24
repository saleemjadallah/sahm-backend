import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

  await prisma.$connect();
  fastify.log.info("Prisma connected to database");

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
    fastify.log.info("Prisma disconnected from database");
  });
}

export default fp(prismaPlugin, {
  name: "prisma",
});

import "@fastify/multipart";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import fastifyRawBody from "fastify-raw-body";
import Fastify from "fastify";
import { env } from "@/config/env.js";
import { authenticateRequest } from "@/lib/auth.js";
import { registerRoutes } from "@/routes/index.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
            }
          : undefined,
    },
    bodyLimit: 25 * 1024 * 1024,
  });

  app.decorateRequest("authUser", null);

  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: true,
    credentials: true,
  });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 10,
    },
  });
  app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  app.addHook("preHandler", async (request) => {
    request.authUser = await authenticateRequest(request);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    reply.status(statusCode).send({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  });

  registerRoutes(app);

  return app;
}

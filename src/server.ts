import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";
import { RATE_LIMITS, UPLOAD_LIMITS } from "./config/constants.js";

// Route imports
import { authRoutes } from "./routes/auth/index.js";
import { projectRoutes } from "./routes/projects/index.js";
import { designRoutes, generateSuiteRoute } from "./routes/designs/index.js";
import { translateRoutes } from "./routes/translate/index.js";
import { paymentRoutes } from "./routes/payments/index.js";
import { webhookRoute } from "./routes/payments/webhook.js";
import { rsvpRoutes } from "./routes/rsvp/index.js";
import { guestRoutes } from "./routes/guests/index.js";
import { milestoneRoutes } from "./routes/milestones/index.js";

// ─── Build Server ────────────────────────────────────────

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
                colorize: true,
              },
            }
          : undefined,
    },
  });

  // ─── Global Error Handler ───────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ─── Plugins ────────────────────────────────────────────

  // CORS — allow frontend origin
  await fastify.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Helmet — security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable CSP for API server
  });

  // Rate limiting — global default
  await fastify.register(rateLimit, {
    max: RATE_LIMITS.GLOBAL.max,
    timeWindow: RATE_LIMITS.GLOBAL.timeWindow,
  });

  // Cookie support
  await fastify.register(cookie);

  // Multipart file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    },
  });

  // Swagger API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Sahm API \u0633\u0647\u0645",
        description: "Gulf Life Moments Platform \u2014 API Documentation",
        version: "0.1.0",
      },
      servers: [
        {
          url: env.APP_URL,
          description: env.NODE_ENV === "production" ? "Production" : "Development",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Database (Prisma)
  await fastify.register(prismaPlugin);

  // Auth (JWT verification preHandler on every request)
  await fastify.register(authPlugin);

  // ─── Routes ─────────────────────────────────────────────

  // Health check (outside /api prefix)
  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  // API routes under /api prefix
  await fastify.register(
    async function apiRoutes(api) {
      // Auth: /api/auth/*
      await api.register(authRoutes, { prefix: "/auth" });

      // Projects: /api/projects/*
      await api.register(projectRoutes, { prefix: "/projects" });

      // Generate suite lives under /api/projects/:id/generate
      await api.register(generateSuiteRoute, { prefix: "/projects" });

      // Designs: /api/designs/*
      await api.register(designRoutes, { prefix: "/designs" });

      // Translate: /api/translate/*
      await api.register(translateRoutes, { prefix: "/translate" });

      // Payments: /api/payments/*
      await api.register(paymentRoutes, { prefix: "/payments" });

      // Stripe webhook: /api/webhooks/stripe (separate from payment routes, no auth)
      await api.register(webhookRoute, { prefix: "/webhooks" });

      // RSVP (public): /api/rsvp/*
      await api.register(rsvpRoutes, { prefix: "/rsvp" });

      // Guests: /api/projects/:projectId/guests/*
      await api.register(guestRoutes, { prefix: "/projects" });

      // Milestones: /api/projects/:projectId/milestones/*
      await api.register(milestoneRoutes, { prefix: "/projects" });
    },
    { prefix: "/api" },
  );

  return fastify;
}

// ─── Start Server ─────────────────────────────────────────

async function start() {
  const fastify = await buildServer();

  try {
    const address = await fastify.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });
    fastify.log.info(`Sahm backend running at ${address}`);
    fastify.log.info(`API docs available at ${address}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // ─── Graceful Shutdown ──────────────────────────────────

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await fastify.close();
      fastify.log.info("Server closed");
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();

export { buildServer };

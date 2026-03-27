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
import { categoryRoutes } from "./routes/categories/index.js";
import { generationRoutes } from "./routes/generations/index.js";
import { packRoutes } from "./routes/packs/index.js";
import { referenceAssetRoutes } from "./routes/reference-assets/index.js";
import { creditRoutes } from "./routes/credits/index.js";
import { paymentRoutes } from "./routes/payments/index.js";
import { translateRoutes } from "./routes/translate/index.js";
import { webhookRoute } from "./routes/payments/webhook.js";

function getAllowedFrontendOrigins(frontendUrl: string): string[] {
  const normalized = frontendUrl.replace(/\/+$/, "");
  const origins = new Set([normalized]);

  try {
    const url = new URL(normalized);
    const { protocol, hostname, port } = url;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (!isLocalhost) {
      const alternateHostname = hostname.startsWith("www.")
        ? hostname.slice(4)
        : `www.${hostname}`;
      const alternateOrigin = `${protocol}//${alternateHostname}${port ? `:${port}` : ""}`;
      origins.add(alternateOrigin);
    }
  } catch {
    // Fall back to the explicitly configured origin only.
  }

  return [...origins];
}

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
  const allowedOrigins = getAllowedFrontendOrigins(env.FRONTEND_URL);
  await fastify.register(cors, {
    origin: allowedOrigins,
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
        title: "Sahm API سهم",
        description: "AI Photo Studio — API Documentation",
        version: "2.0.0",
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
    version: "2.0.0",
  }));

  // API routes under /api prefix
  await fastify.register(
    async function apiRoutes(api) {
      // Auth: /api/auth/*
      await api.register(authRoutes, { prefix: "/auth" });

      // Categories: /api/categories/* (public)
      await api.register(categoryRoutes, { prefix: "/categories" });

      // Generations: /api/generations/* + POST /api/generate
      await api.register(generationRoutes, { prefix: "/generations" });

      // The main generate endpoint also at /api/generate for convenience
      await api.register(
        async function (gen) {
          gen.post("/", { preHandler: [(await import("./middleware/requireAuth.js")).requireAuth] }, async (request, reply) => {
            const { generateSingle } = await import("./services/generation.service.js");
            const generation = await generateSingle(gen.prisma, request.userId!, request.body as Parameters<typeof generateSingle>[2]);
            return reply.code(201).send({
              success: true,
              data: {
                id: generation.id,
                categoryId: generation.categoryId,
                subcategoryId: generation.subcategoryId,
                userPrompt: generation.userPrompt,
                style: generation.style,
                aspectRatio: generation.aspectRatio,
                referenceAssetId: generation.referenceAssetId,
                previewUrl: generation.previewUrl,
                fullUrl: generation.isDownloaded ? generation.fullUrl : null,
                status: generation.status,
                creditsCost: generation.creditsCost,
                packId: generation.packId,
                isDownloaded: generation.isDownloaded,
                createdAt: generation.createdAt.toISOString(),
              },
            });
          });
        },
        { prefix: "/generate" },
      );

      // Packs: /api/packs/*
      await api.register(packRoutes, { prefix: "/packs" });

      // Reference assets: /api/reference-assets/*
      await api.register(referenceAssetRoutes, { prefix: "/reference-assets" });

      // Credits: /api/credits/*
      await api.register(creditRoutes, { prefix: "/credits" });

      // Payments: /api/payments/*
      await api.register(paymentRoutes, { prefix: "/payments" });

      // Translate: /api/translate/*
      await api.register(translateRoutes, { prefix: "/translate" });

      // Stripe webhook: /api/webhooks/stripe
      await api.register(webhookRoute, { prefix: "/webhooks" });
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

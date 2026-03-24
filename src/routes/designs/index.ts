import type { FastifyInstance } from "fastify";
import { generateSuiteRoute } from "./generate-suite.js";
import { regenerateDesignRoute } from "./regenerate.js";
import { downloadDesignRoute } from "./download.js";
import { stylePreviewsRoute } from "./style-previews.js";

export async function designRoutes(fastify: FastifyInstance) {
  // POST /api/projects/:id/generate — registered under /api/projects prefix
  // (handled in server.ts route registration)

  // POST /api/designs/:id/regenerate — Regenerate a single design
  // POST /api/designs/:id/edit — Edit text and regenerate
  await fastify.register(regenerateDesignRoute);

  // POST /api/designs/:id/download — Get download URL
  await fastify.register(downloadDesignRoute);

  // GET /api/designs/style-previews — Public style preview URLs
  await fastify.register(stylePreviewsRoute);
}

// Export generate suite separately since it registers under /api/projects prefix
export { generateSuiteRoute };

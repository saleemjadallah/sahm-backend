import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { STYLE_GUIDES } from "../../lib/ai/style-guides.js";

/**
 * GET /api/designs/style-previews
 *
 * Returns public R2 URLs for pre-generated style preview images.
 * No auth required — these are static public assets.
 */
export async function stylePreviewsRoute(fastify: FastifyInstance) {
  fastify.get("/style-previews", async (_req, reply) => {
    const baseUrl = env.R2_PUBLIC_URL;

    if (!baseUrl) {
      return reply.status(503).send({
        success: false,
        error: "CDN not configured",
      });
    }

    const previews: Record<string, string> = {};
    for (const styleId of Object.keys(STYLE_GUIDES)) {
      previews[styleId] = `${baseUrl}/style-previews/${styleId}.webp`;
    }

    return { success: true, data: previews };
  });
}

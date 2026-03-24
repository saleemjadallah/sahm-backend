import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { regenerateDesign, editDesign } from "../../services/design.service.js";
import { NotFoundError } from "../../errors/index.js";
import type { ApiResponse, DesignResponse } from "../../types/index.js";

const regenerateSchema = z.object({
  style: z.string().max(50).optional(),
});

const editSchema = z.object({
  textContent: z.record(z.record(z.string())),
});

export async function regenerateDesignRoute(fastify: FastifyInstance) {
  // POST /api/designs/:id/regenerate — Regenerate a single design
  fastify.post<{ Params: { id: string } }>(
    "/:id/regenerate",
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: designId } = request.params;
      const userId = request.user!.id;
      const body = regenerateSchema.parse(request.body || {});

      // Verify ownership via design -> project -> user
      const existing = await fastify.prisma.design.findUnique({
        where: { id: designId },
        include: { project: { select: { userId: true } } },
      });

      if (!existing || existing.project.userId !== userId) {
        throw new NotFoundError("Design");
      }

      const design = await regenerateDesign(fastify.prisma, designId, body.style);

      const response: ApiResponse<DesignResponse> = {
        success: true,
        data: formatDesign(design),
      };

      reply.send(response);
    },
  );

  // POST /api/designs/:id/edit — Edit text content and regenerate
  fastify.post<{ Params: { id: string } }>(
    "/:id/edit",
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: designId } = request.params;
      const userId = request.user!.id;
      const body = editSchema.parse(request.body);

      const existing = await fastify.prisma.design.findUnique({
        where: { id: designId },
        include: { project: { select: { userId: true } } },
      });

      if (!existing || existing.project.userId !== userId) {
        throw new NotFoundError("Design");
      }

      const design = await editDesign(fastify.prisma, designId, body.textContent);

      const response: ApiResponse<DesignResponse> = {
        success: true,
        data: formatDesign(design),
      };

      reply.send(response);
    },
  );
}

function formatDesign(d: {
  id: string;
  projectId: string;
  designType: string;
  style: string | null;
  previewUrl: string;
  fullUrl: string | null;
  aspectRatio: string;
  generationStatus: string;
  textContent: unknown;
  isDownloaded: boolean;
  createdAt: Date;
}): DesignResponse {
  return {
    id: d.id,
    projectId: d.projectId,
    designType: d.designType as DesignResponse["designType"],
    style: d.style,
    previewUrl: d.previewUrl,
    fullUrl: d.fullUrl,
    aspectRatio: d.aspectRatio,
    generationStatus: d.generationStatus as DesignResponse["generationStatus"],
    textContent: d.textContent as Record<string, Record<string, string>> | null,
    isDownloaded: d.isDownloaded,
    createdAt: d.createdAt.toISOString(),
  };
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { generateSuite } from "../../services/design.service.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { ApiResponse, DesignResponse } from "../../types/index.js";

const generateSuiteSchema = z.object({
  style: z.string().max(50).optional(),
});

export async function generateSuiteRoute(fastify: FastifyInstance) {
  fastify.post<{ Params: { id: string } }>(
    "/:id/generate",
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: projectId } = request.params;
      const userId = request.user!.id;
      const body = generateSuiteSchema.parse(request.body || {});

      // Verify project ownership
      const project = await fastify.prisma.project.findFirst({
        where: { id: projectId, userId },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      // Update style in metadata if provided
      if (body.style) {
        const metadata = (project.metadata as Record<string, unknown>) || {};
        await fastify.prisma.project.update({
          where: { id: projectId },
          data: { metadata: { ...metadata, style: body.style } },
        });
      }

      // Start generation (this may take a while)
      const designs = await generateSuite(fastify.prisma, projectId);

      const response: ApiResponse<DesignResponse[]> = {
        success: true,
        data: designs.map((d) => ({
          id: d.id,
          projectId: d.projectId,
          designType: d.designType,
          style: d.style,
          previewUrl: d.previewUrl,
          fullUrl: d.fullUrl,
          aspectRatio: d.aspectRatio,
          generationStatus: d.generationStatus,
          textContent: d.textContent as Record<string, Record<string, string>> | null,
          isDownloaded: d.isDownloaded,
          createdAt: d.createdAt.toISOString(),
        })),
      };

      reply.send(response);
    },
  );
}

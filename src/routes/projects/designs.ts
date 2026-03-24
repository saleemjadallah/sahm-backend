import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { NotFoundError } from "../../errors/index.js";
import type { ApiResponse, DesignResponse } from "../../types/index.js";

export async function getProjectDesignsRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    "/:id/designs",
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: projectId } = request.params;
      const userId = request.user!.id;

      const project = await fastify.prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      const designs = await fastify.prisma.design.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
      });

      const response: ApiResponse<DesignResponse[]> = {
        success: true,
        data: designs.map((design) => ({
          id: design.id,
          projectId: design.projectId,
          designType: design.designType,
          style: design.style,
          previewUrl: design.previewUrl,
          fullUrl: design.fullUrl,
          aspectRatio: design.aspectRatio,
          generationStatus: design.generationStatus,
          textContent: design.textContent as Record<string, Record<string, string>> | null,
          isDownloaded: design.isDownloaded,
          createdAt: design.createdAt.toISOString(),
        })),
      };

      reply.send(response);
    },
  );
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { NotFoundError } from "../../errors/index.js";
import type { ApiResponse } from "../../types/index.js";

interface GenerationStatusResponse {
  projectId: string;
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percent: number;
  designs: Array<{
    id: string;
    designType: string;
    generationStatus: string;
    previewUrl: string;
  }>;
}

export async function getGenerationStatusRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    "/:id/generation-status",
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
        select: {
          id: true,
          designType: true,
          generationStatus: true,
          previewUrl: true,
        },
      });

      const total = designs.length;
      const completed = designs.filter((design) => design.generationStatus === "COMPLETED").length;
      const failed = designs.filter((design) => design.generationStatus === "FAILED").length;
      const inProgress = designs.filter((design) =>
        design.generationStatus === "PENDING" || design.generationStatus === "GENERATING"
      ).length;

      const response: ApiResponse<GenerationStatusResponse> = {
        success: true,
        data: {
          projectId,
          total,
          completed,
          failed,
          inProgress,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          designs: designs.map((design) => ({
            id: design.id,
            designType: design.designType,
            generationStatus: design.generationStatus,
            previewUrl: design.previewUrl,
          })),
        },
      };

      reply.send(response);
    },
  );
}

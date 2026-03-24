import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { generateSuite } from "../../services/design.service.js";
import { NotFoundError } from "../../errors/index.js";
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

      fastify.log.info({ projectId, userId }, "Starting suite generation");

      void generateSuite(fastify.prisma, projectId).catch(async (error) => {
        fastify.log.error(
          { err: error, projectId, userId },
          "Suite generation failed",
        );

        try {
          await fastify.prisma.design.updateMany({
            where: {
              projectId,
              generationStatus: { in: ["PENDING", "GENERATING"] },
            },
            data: { generationStatus: "FAILED" },
          });
        } catch (markFailedError) {
          fastify.log.error(
            { err: markFailedError, projectId },
            "Failed to mark unfinished designs as FAILED",
          );
        }
      });

      const response: ApiResponse<DesignResponse[]> = {
        success: true,
        data: [],
      };

      reply.status(202).send(response);
    },
  );
}

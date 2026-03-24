import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getProjectMilestones, scheduleMilestones } from "../../services/milestone.service.js";
import { NotFoundError } from "../../errors/index.js";
import type { ApiResponse } from "../../types/index.js";

const projectIdParamSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export async function milestoneRoutes(fastify: FastifyInstance) {
  // All milestone routes require authentication
  fastify.addHook("preHandler", requireAuth);

  // GET /api/projects/:projectId/milestones — list milestones for a baby project
  fastify.get<{ Params: { projectId: string } }>(
    "/:projectId/milestones",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;

      // Verify ownership
      const project = await fastify.prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      const milestones = await getProjectMilestones(fastify.prisma, projectId);

      const response: ApiResponse = {
        success: true,
        data: milestones,
      };

      reply.send(response);
    },
  );

  // POST /api/projects/:projectId/milestones/schedule — schedule milestones for a baby project
  fastify.post<{ Params: { projectId: string } }>(
    "/:projectId/milestones/schedule",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;

      // Verify ownership
      const project = await fastify.prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      await scheduleMilestones(fastify.prisma, projectId);

      const response: ApiResponse = {
        success: true,
        data: { message: "Milestones scheduled successfully" },
      };

      reply.status(201).send(response);
    },
  );
}

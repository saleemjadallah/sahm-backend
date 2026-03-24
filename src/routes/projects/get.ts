import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { NotFoundError } from "../../errors/index.js";
import type { ApiResponse, ProjectResponse } from "../../types/index.js";

export async function getProjectRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const project = await fastify.prisma.project.findFirst({
        where: { id, userId },
        include: {
          designs: {
            orderBy: { createdAt: "asc" },
          },
          guests: {
            orderBy: { createdAt: "desc" },
            take: 100,
          },
          milestones: {
            orderBy: { triggerDate: "asc" },
          },
        },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      const response: ApiResponse<ProjectResponse & { guests?: unknown[]; milestones?: unknown[] }> = {
        success: true,
        data: {
          id: project.id,
          type: project.type,
          title: project.title,
          status: project.status,
          nameEn: project.nameEn,
          nameAr: project.nameAr,
          nameHi: project.nameHi,
          date: project.date?.toISOString() || null,
          dateHijri: project.dateHijri,
          languages: JSON.parse(project.languages),
          rsvpSlug: project.rsvpSlug,
          metadata: project.metadata as ProjectResponse["metadata"],
          designs: project.designs.map((d) => ({
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
          guests: project.guests,
          milestones: project.milestones,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
      };

      reply.send(response);
    },
  );
}

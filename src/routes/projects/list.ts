import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listProjectsSchema } from "./schemas.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import type { ApiResponse, PaginatedResponse, ProjectResponse } from "../../types/index.js";

export async function listProjectsRoute(fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listProjectsSchema.parse(request.query);
      const userId = request.user!.id;

      const where: Record<string, unknown> = { userId };
      if (query.type) where.type = query.type;
      if (query.status) where.status = query.status;

      const [projects, total] = await Promise.all([
        fastify.prisma.project.findMany({
          where,
          include: {
            designs: {
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { updatedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        fastify.prisma.project.count({ where }),
      ]);

      const data: ProjectResponse[] = projects.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        status: p.status,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        nameHi: p.nameHi,
        date: p.date?.toISOString() || null,
        dateHijri: p.dateHijri,
        languages: JSON.parse(p.languages),
        rsvpSlug: p.rsvpSlug,
        metadata: p.metadata as ProjectResponse["metadata"],
        designs: p.designs.map((d) => ({
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
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      const response: ApiResponse<PaginatedResponse<ProjectResponse>> = {
        success: true,
        data: {
          data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        },
      };

      reply.send(response);
    },
  );
}

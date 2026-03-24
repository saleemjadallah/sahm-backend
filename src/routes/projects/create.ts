import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createProjectSchema } from "./schemas.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import type { ApiResponse, ProjectResponse } from "../../types/index.js";

export async function createProjectRoute(fastify: FastifyInstance) {
  fastify.post(
    "/",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createProjectSchema.parse(request.body);
      const userId = request.user!.id;

      const project = await fastify.prisma.project.create({
        data: {
          userId,
          type: body.type,
          title: body.title,
          nameEn: body.nameEn,
          nameAr: body.nameAr,
          nameHi: body.nameHi,
          date: body.date ? new Date(body.date) : undefined,
          dateHijri: body.dateHijri,
          languages: JSON.stringify(body.languages),
          metadata: body.metadata
            ? (body.metadata as Prisma.InputJsonValue)
            : undefined,
        },
        include: {
          designs: true,
        },
      });

      // If style is provided, store it in metadata
      if (body.style) {
        const existingMeta = (project.metadata as Record<string, unknown>) || {};
        await fastify.prisma.project.update({
          where: { id: project.id },
          data: {
            metadata: {
              ...existingMeta,
              style: body.style,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const response: ApiResponse<ProjectResponse> = {
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
          designs: [],
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
      };

      reply.status(201).send(response);
    },
  );
}

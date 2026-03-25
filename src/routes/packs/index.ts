import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { generatePack } from "../../services/generation.service.js";
import { NotFoundError } from "../../errors/index.js";
import type { CreatePackRequest, GenerationResponse } from "../../types/index.js";

export async function packRoutes(fastify: FastifyInstance) {
  // POST /api/packs — create a pack and generate all images
  fastify.post<{ Body: CreatePackRequest }>(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.userId!;
      const { packId, generations } = await generatePack(
        fastify.prisma,
        userId,
        request.body,
      );

      return reply.code(201).send({
        success: true,
        data: {
          id: packId,
          categoryId: request.body.categoryId,
          label: `Pack`,
          style: request.body.style || null,
          generations: generations.map((g) => ({
            id: g.id,
            categoryId: g.categoryId,
            subcategoryId: g.subcategoryId,
            userPrompt: g.userPrompt,
            style: g.style,
            aspectRatio: g.aspectRatio,
            previewUrl: g.previewUrl,
            fullUrl: g.fullUrl,
            status: g.status,
            creditsCost: g.creditsCost,
            packId: g.packId,
            isDownloaded: g.isDownloaded,
            createdAt: g.createdAt.toISOString(),
          })),
          createdAt: new Date().toISOString(),
        },
      });
    },
  );

  // GET /api/packs/:id — get pack with all generations
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const pack = await fastify.prisma.pack.findFirst({
        where: { id: request.params.id, userId: request.userId! },
        include: {
          generations: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!pack) throw new NotFoundError("Pack");

      return reply.send({
        success: true,
        data: {
          id: pack.id,
          categoryId: pack.categoryId,
          label: pack.label,
          style: pack.style,
          generations: pack.generations.map((g) => ({
            id: g.id,
            categoryId: g.categoryId,
            subcategoryId: g.subcategoryId,
            userPrompt: g.userPrompt,
            style: g.style,
            aspectRatio: g.aspectRatio,
            previewUrl: g.previewUrl,
            fullUrl: g.fullUrl,
            status: g.status,
            creditsCost: g.creditsCost,
            packId: g.packId,
            isDownloaded: g.isDownloaded,
            createdAt: g.createdAt.toISOString(),
          })),
          createdAt: pack.createdAt.toISOString(),
        },
      });
    },
  );
}

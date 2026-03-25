import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { generateSingle, regenerateGeneration } from "../../services/generation.service.js";
import { NotFoundError } from "../../errors/index.js";
import type { GenerateRequest, RegenerateRequest, GenerationResponse } from "../../types/index.js";

function toResponse(g: {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  userPrompt: string | null;
  style: string | null;
  aspectRatio: string;
  previewUrl: string | null;
  fullUrl: string | null;
  status: string;
  creditsCost: number;
  packId: string | null;
  isDownloaded: boolean;
  createdAt: Date;
}): GenerationResponse {
  return {
    id: g.id,
    categoryId: g.categoryId,
    subcategoryId: g.subcategoryId,
    userPrompt: g.userPrompt,
    style: g.style,
    aspectRatio: g.aspectRatio,
    previewUrl: g.previewUrl,
    fullUrl: g.fullUrl,
    status: g.status as GenerationResponse["status"],
    creditsCost: g.creditsCost,
    packId: g.packId,
    isDownloaded: g.isDownloaded,
    createdAt: g.createdAt.toISOString(),
  };
}

export async function generationRoutes(fastify: FastifyInstance) {
  // POST /api/generate — generate a single image
  fastify.post<{ Body: GenerateRequest }>(
    "/generate",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.userId!;
      const generation = await generateSingle(fastify.prisma, userId, request.body);
      return reply.code(201).send({ success: true, data: toResponse(generation) });
    },
  );

  // GET /api/generations — list user's generations
  fastify.get<{ Querystring: { page?: string; limit?: string; categoryId?: string } }>(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.userId!;
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || "20", 10)));
      const where: Record<string, unknown> = { userId };
      if (request.query.categoryId) where.categoryId = request.query.categoryId;

      const [generations, total] = await Promise.all([
        fastify.prisma.generation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        fastify.prisma.generation.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: generations.map(toResponse),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // GET /api/generations/:id — get single generation
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const generation = await fastify.prisma.generation.findFirst({
        where: { id: request.params.id, userId: request.userId! },
      });
      if (!generation) throw new NotFoundError("Generation");
      return reply.send({ success: true, data: toResponse(generation) });
    },
  );

  // POST /api/generations/:id/regenerate — regenerate with new style/prompt
  fastify.post<{ Params: { id: string }; Body: RegenerateRequest }>(
    "/:id/regenerate",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.userId!;
      const { style, userPrompt } = request.body || {};
      const generation = await regenerateGeneration(
        fastify.prisma,
        userId,
        request.params.id,
        style,
        userPrompt,
      );
      return reply.send({ success: true, data: toResponse(generation) });
    },
  );
}

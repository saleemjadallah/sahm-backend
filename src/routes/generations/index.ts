import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  generateSingle,
  regenerateGeneration,
  unlockGenerationExport,
  getGenerationStoragePrefix,
} from "../../services/generation.service.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../errors/index.js";
import { buildDesignKey, getFile, deleteFile } from "../../lib/storage/r2-client.js";
import type { GenerateRequest, RegenerateRequest, GenerationResponse } from "../../types/index.js";
import {
  createGuestGenerationToken,
  verifyGuestGenerationToken,
} from "../../lib/auth/guest-generation-token.js";

function toResponse(g: {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  userPrompt: string | null;
  style: string | null;
  aspectRatio: string;
  referenceAssetId: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  status: string;
  creditsCost: number;
  packId: string | null;
  isDownloaded: boolean;
  createdAt: Date;
}, guestAccessToken?: string | null): GenerationResponse {
  return {
    id: g.id,
    categoryId: g.categoryId,
    subcategoryId: g.subcategoryId,
    userPrompt: g.userPrompt,
    style: g.style,
    aspectRatio: g.aspectRatio,
    referenceAssetId: g.referenceAssetId,
    previewUrl: g.previewUrl,
    fullUrl: g.isDownloaded ? g.fullUrl : null,
    status: g.status as GenerationResponse["status"],
    creditsCost: g.creditsCost,
    packId: g.packId,
    isDownloaded: g.isDownloaded,
    createdAt: g.createdAt.toISOString(),
    guestAccessToken: guestAccessToken ?? null,
  };
}

export async function generationRoutes(fastify: FastifyInstance) {
  // POST /api/generate — generate a single image
  fastify.post<{ Body: GenerateRequest }>(
    "/generate",
    async (request, reply) => {
      const userId = request.user?.id ?? null;
      const generation = await generateSingle(fastify.prisma, userId, request.body);
      return reply.code(201).send({
        success: true,
        data: toResponse(
          generation,
          userId ? null : createGuestGenerationToken(generation.id),
        ),
      });
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
        data: generations.map((generation) => toResponse(generation)),
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
  fastify.get<{ Params: { id: string }; Querystring: { guestAccessToken?: string } }>(
    "/:id",
    async (request, reply) => {
      const viewerUserId = request.user?.id ?? null;
      const hasGuestAccess = !viewerUserId
        && Boolean(request.query.guestAccessToken)
        && verifyGuestGenerationToken(request.query.guestAccessToken!, request.params.id);

      if (!viewerUserId && !hasGuestAccess) {
        throw new UnauthorizedError("Authentication required");
      }

      const generation = await fastify.prisma.generation.findFirst({
        where: viewerUserId
          ? { id: request.params.id, userId: viewerUserId }
          : { id: request.params.id, userId: null },
      });
      if (!generation) throw new NotFoundError("Generation");
      return reply.send({ success: true, data: toResponse(generation) });
    },
  );

  // GET /api/generations/:id/asset?variant=preview|full — stream the stored image
  fastify.get<{ Params: { id: string }; Querystring: { variant?: "preview" | "full" } }>(
    "/:id/asset",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const generation = await fastify.prisma.generation.findFirst({
        where: { id: request.params.id, userId: request.userId! },
        select: {
          id: true,
          isDownloaded: true,
          status: true,
          userId: true,
          storageKeyPrefix: true,
        },
      });

      if (!generation) throw new NotFoundError("Generation");

      const variant = request.query.variant === "full" ? "full" : "preview";
      if (variant === "full" && !generation.isDownloaded) {
        throw new ForbiddenError("Export is locked");
      }

      const key = buildDesignKey(getGenerationStoragePrefix(generation), generation.id, variant);
      const file = await getFile(key);

      return reply
        .header("Cache-Control", "private, max-age=300")
        .type(file.contentType || "image/webp")
        .send(file.buffer);
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

  // DELETE /api/generations/:id — delete a generation and its stored images
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.userId!;
      const generation = await fastify.prisma.generation.findFirst({
        where: { id: request.params.id, userId },
        select: {
          id: true,
          userId: true,
          storageKeyPrefix: true,
        },
      });
      if (!generation) throw new NotFoundError("Generation");

      // Delete stored images from R2 (best-effort — don't block on storage errors)
      const variants = ["preview", "full"] as const;
      await Promise.allSettled(
        variants.map((v) =>
          deleteFile(buildDesignKey(getGenerationStoragePrefix(generation), generation.id, v)),
        ),
      );

      await fastify.prisma.generation.delete({ where: { id: generation.id } });

      return reply.code(200).send({ success: true });
    },
  );

  // POST /api/generations/:id/unlock-export — spend credits on first export access
  fastify.post<{ Params: { id: string } }>(
    "/:id/unlock-export",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const generation = await unlockGenerationExport(
        fastify.prisma,
        request.userId!,
        request.params.id,
      );
      return reply.send({ success: true, data: toResponse(generation) });
    },
  );

  fastify.post<{ Params: { id: string }; Body: { guestAccessToken?: string } }>(
    "/:id/claim",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { guestAccessToken } = request.body || {};

      if (!guestAccessToken || !verifyGuestGenerationToken(guestAccessToken, request.params.id)) {
        throw new UnauthorizedError("Valid guest access is required");
      }

      const generation = await fastify.prisma.$transaction(async (tx) => {
        const current = await tx.generation.findUnique({
          where: { id: request.params.id },
        });

        if (!current) throw new NotFoundError("Generation");
        if (current.userId === request.userId!) return current;
        if (current.userId) throw new NotFoundError("Generation");

        return tx.generation.update({
          where: { id: current.id },
          data: { userId: request.userId! },
        });
      });

      return reply.send({ success: true, data: toResponse(generation) });
    },
  );
}

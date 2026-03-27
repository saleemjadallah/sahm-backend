import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { ValidationError } from "../../errors/index.js";
import { getFile } from "../../lib/storage/r2-client.js";
import {
  deleteReferenceAssetForUser,
  getReferenceAssetForUser,
  uploadReferenceAsset,
} from "../../services/reference-image.service.js";
import type { ReferenceAssetResponse } from "../../types/index.js";

function toResponse(asset: {
  id: string;
  categoryId: string;
  originalFilename: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}): ReferenceAssetResponse {
  return {
    id: asset.id,
    categoryId: asset.categoryId,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function referenceAssetRoutes(fastify: FastifyInstance) {
  fastify.post<{ Querystring: { categoryId?: string } }>(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const categoryId = request.query.categoryId?.trim();
      if (!categoryId) throw new ValidationError("categoryId is required");

      const file = await request.file();
      if (!file) throw new ValidationError("Reference image file is required");

      const buffer = await file.toBuffer();
      const asset = await uploadReferenceAsset(fastify.prisma, request.userId!, {
        categoryId,
        filename: file.filename,
        mimeType: file.mimetype,
        buffer,
      });

      return reply.code(201).send({ success: true, data: toResponse(asset) });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const asset = await getReferenceAssetForUser(
        fastify.prisma,
        request.userId!,
        request.params.id,
      );
      return reply.send({ success: true, data: toResponse(asset) });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/:id/asset",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const asset = await getReferenceAssetForUser(
        fastify.prisma,
        request.userId!,
        request.params.id,
      );
      const stored = await getFile(asset.storageKey);

      return reply
        .header("Cache-Control", "private, max-age=300")
        .type(asset.mimeType || stored.contentType || "image/png")
        .send(stored.buffer);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      await deleteReferenceAssetForUser(fastify.prisma, request.userId!, request.params.id);
      return reply.code(200).send({ success: true });
    },
  );
}

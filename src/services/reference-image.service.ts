import sharp from "sharp";
import { nanoid } from "nanoid";
import type { PrismaClient, ReferenceAsset } from "@prisma/client";
import { ValidationError, NotFoundError, ForbiddenError } from "../errors/index.js";
import { getCategory } from "../lib/categories/index.js";
import { getReferenceImageConfig } from "../lib/reference-images/config.js";
import {
  buildReferenceAssetKey,
  deleteFile,
  getFile,
  uploadFile,
} from "../lib/storage/r2-client.js";

const REFERENCE_MAX_DIMENSION = 1536;
const REFERENCE_OUTPUT_MIME = "image/png";

interface UploadReferenceAssetInput {
  categoryId: string;
  filename?: string | null;
  mimeType?: string | null;
  buffer: Buffer;
}

function assertAllowedMimeType(mimeType?: string | null): void {
  if (!mimeType) {
    throw new ValidationError("Reference image MIME type is required");
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    throw new ValidationError("Reference image must be PNG, JPEG, or WebP");
  }
}

async function normalizeReferenceImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  width: number | null;
  height: number | null;
}> {
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new ValidationError("Could not read the uploaded reference image");
  }

  const normalized = await image
    .resize(REFERENCE_MAX_DIMENSION, REFERENCE_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: normalized.data,
    width: normalized.info.width ?? metadata.width ?? null,
    height: normalized.info.height ?? metadata.height ?? null,
  };
}

export async function uploadReferenceAsset(
  prisma: PrismaClient,
  userId: string,
  input: UploadReferenceAssetInput,
): Promise<ReferenceAsset> {
  assertAllowedMimeType(input.mimeType);

  const category = await getCategory(prisma, input.categoryId);
  if (!category) throw new NotFoundError("Category");

  if (!getReferenceImageConfig(input.categoryId)) {
    throw new ValidationError("Reference images are not supported for this category");
  }

  const normalized = await normalizeReferenceImage(input.buffer);
  const assetId = nanoid();
  const storageKey = buildReferenceAssetKey(userId, assetId, "png");

  await uploadFile(storageKey, normalized.buffer, REFERENCE_OUTPUT_MIME);

  return prisma.referenceAsset.create({
    data: {
      id: assetId,
      userId,
      categoryId: input.categoryId,
      originalFilename: input.filename ?? null,
      storageKey,
      mimeType: REFERENCE_OUTPUT_MIME,
      fileSize: normalized.buffer.byteLength,
      width: normalized.width,
      height: normalized.height,
    },
  });
}

export async function getReferenceAssetForUser(
  prisma: PrismaClient,
  userId: string,
  assetId: string,
): Promise<ReferenceAsset> {
  const asset = await prisma.referenceAsset.findFirst({
    where: { id: assetId, userId },
  });

  if (!asset) throw new NotFoundError("Reference asset");
  return asset;
}

export async function loadReferenceAssetBuffer(
  prisma: PrismaClient,
  userId: string,
  assetId: string,
  categoryId: string,
): Promise<{ asset: ReferenceAsset; buffer: Buffer }> {
  const asset = await getReferenceAssetForUser(prisma, userId, assetId);

  if (asset.categoryId !== categoryId) {
    throw new ValidationError("Reference image belongs to a different category");
  }

  const file = await getFile(asset.storageKey);
  return { asset, buffer: file.buffer };
}

export async function deleteReferenceAssetForUser(
  prisma: PrismaClient,
  userId: string,
  assetId: string,
): Promise<void> {
  const asset = await getReferenceAssetForUser(prisma, userId, assetId);
  const usageCount = await prisma.generation.count({
    where: { referenceAssetId: assetId },
  });

  if (usageCount > 0) {
    throw new ForbiddenError("Reference image is already attached to a generation");
  }

  await Promise.all([
    prisma.referenceAsset.delete({ where: { id: asset.id } }),
    deleteFile(asset.storageKey),
  ]);
}

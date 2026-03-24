import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { StorageError } from "../../errors/index.js";

// ─── S3-Compatible Client for Cloudflare R2 ────────────

const s3Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
});

/**
 * Upload a file to R2.
 * @returns The public URL of the uploaded file.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return `${env.R2_PUBLIC_URL}/${key}`;
  } catch (err) {
    throw new StorageError(
      `Failed to upload file: ${key}`,
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * Generate a signed URL for private file access.
 * @param key - The object key in R2.
 * @param expiresIn - Expiration time in seconds (default: 1 hour).
 */
export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
    });

    return await awsGetSignedUrl(s3Client, command, { expiresIn });
  } catch (err) {
    throw new StorageError(
      `Failed to generate signed URL for: ${key}`,
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
      }),
    );
  } catch (err) {
    throw new StorageError(
      `Failed to delete file: ${key}`,
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * Build a storage key for a design image.
 */
export function buildDesignKey(
  projectId: string,
  designId: string,
  variant: "preview" | "full",
  ext = "webp",
): string {
  return `designs/${projectId}/${designId}/${variant}.${ext}`;
}

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

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY) throw new StorageError("R2 storage is not configured");
    _s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY,
        secretAccessKey: env.R2_SECRET_KEY,
      },
    });
  }
  return _s3;
}

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
    await getS3().send(
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

    return await awsGetSignedUrl(getS3(), command, { expiresIn });
  } catch (err) {
    throw new StorageError(
      `Failed to generate signed URL for: ${key}`,
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * Read a file from R2 and return its bytes plus metadata.
 */
export async function getFile(
  key: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  try {
    const result = await getS3().send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
      }),
    );

    if (!result.Body || typeof result.Body.transformToByteArray !== "function") {
      throw new StorageError(`R2 object body missing for: ${key}`);
    }

    const bytes = await result.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType ?? null,
    };
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(
      `Failed to read file: ${key}`,
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await getS3().send(
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

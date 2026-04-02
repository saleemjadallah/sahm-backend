import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/config/env.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const localStorageRoot = path.resolve(dirname, "../../.storage");
const client =
  env.R2_ENDPOINT && env.R2_ACCESS_KEY && env.R2_SECRET_KEY
    ? new S3Client({
        region: "auto",
        endpoint: env.R2_ENDPOINT,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY,
          secretAccessKey: env.R2_SECRET_KEY,
        },
      })
    : null;

export function getPublicUrl(key: string) {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }

  if (!client) {
    return `${env.APP_URL.replace(/\/$/, "")}/files/${key}`;
  }

  if (env.R2_ACCOUNT_ID) {
    return `https://${env.R2_BUCKET}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  }

  return key;
}

export async function uploadBuffer(key: string, body: Buffer, contentType: string) {
  if (!client) {
    const localPath = path.join(localStorageRoot, key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, body);
    return { key, url: getPublicUrl(key) };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: getPublicUrl(key) };
}

export async function deleteObject(key: string) {
  if (!key) {
    return;
  }

  if (!client) {
    const localPath = path.join(localStorageRoot, key);
    await rm(localPath, { force: true });
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
    }),
  );
}

export async function getObjectBuffer(key: string) {
  if (!client) {
    return readFile(path.join(localStorageRoot, key));
  }

  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
    }),
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

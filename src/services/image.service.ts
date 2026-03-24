import sharp from "sharp";
import { uploadFile, buildDesignKey } from "../lib/storage/r2-client.js";
import { WATERMARK_TEXT, WATERMARK_OPACITY, PREVIEW_MAX_WIDTH } from "../config/constants.js";

/**
 * Process a generated image: create watermarked preview + upload full image to R2.
 */
export async function processGeneratedImage(
  imageBuffer: Buffer,
  designId: string,
  projectId: string,
): Promise<{ previewUrl: string; fullUrl: string }> {
  // Upload the full-resolution image
  const fullKey = buildDesignKey(projectId, designId, "full");
  const fullUrl = await uploadFile(fullKey, imageBuffer, "image/webp");

  // Create watermarked preview
  const watermarkedBuffer = await createWatermarkedPreview(imageBuffer);
  const previewKey = buildDesignKey(projectId, designId, "preview");
  const previewUrl = await uploadFile(previewKey, watermarkedBuffer, "image/webp");

  return { previewUrl, fullUrl };
}

/**
 * Create a watermarked preview image using sharp.
 * - Resize to max 1200px width
 * - Overlay diagonal "sahm.app ✦ سهم" watermark at 30% opacity
 */
export async function createWatermarkedPreview(
  buffer: Buffer,
): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = Math.min(metadata.width || PREVIEW_MAX_WIDTH, PREVIEW_MAX_WIDTH);
  const height = metadata.height
    ? Math.round((width / (metadata.width || width)) * metadata.height)
    : width;

  // Create SVG watermark overlay with diagonal text
  const watermarkSvg = buildWatermarkSvg(width, height);

  const result = await sharp(buffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        gravity: "center",
      },
    ])
    .webp({ quality: 80 })
    .toBuffer();

  return result;
}

/**
 * Build an SVG watermark with repeated diagonal text.
 */
function buildWatermarkSvg(width: number, height: number): string {
  const fontSize = Math.max(24, Math.round(width / 20));
  const opacity = WATERMARK_OPACITY;
  const text = WATERMARK_TEXT;

  // Create a pattern of watermark text across the image
  const lines: string[] = [];
  const spacing = fontSize * 4;

  for (let y = -height; y < height * 2; y += spacing) {
    for (let x = -width; x < width * 2; x += spacing * 2) {
      lines.push(
        `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" fill="white" fill-opacity="${opacity}" transform="rotate(-30, ${x}, ${y})">${text}</text>`,
      );
    }
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${lines.join("\n      ")}
    </svg>
  `.trim();
}

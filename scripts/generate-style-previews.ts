/**
 * Generate style preview images via Gemini and upload to R2.
 *
 * Usage:
 *   npx tsx scripts/generate-style-previews.ts            # generate all
 *   npx tsx scripts/generate-style-previews.ts royal floral  # specific styles only
 *
 * Requires env vars: GEMINI_API_KEY, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT, R2_PUBLIC_URL
 */

import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import { generateDesignImage } from "../src/lib/ai/gemini.js";
import { STYLE_GUIDES, type StyleGuide } from "../src/lib/ai/style-guides.js";
import { uploadFile } from "../src/lib/storage/r2-client.js";

/* ─── Preview-specific prompts per style ─── */

const PREVIEW_PROMPTS: Record<string, string> = {
  royal:
    "Generate a luxurious wedding invitation background preview. Rich deep navy background with ornate double-line gold filigree borders and corner flourishes. Gold foil-stamped feel on heavyweight cotton card stock. Elaborate gold geometric patterns and decorative frames. No text, no letters, no words — pure decorative background only.",
  floral:
    "Generate a romantic watercolor floral invitation background. Soft blush pink, sage green, and cream tones. Loose hand-painted garden roses, peonies, and eucalyptus greenery framing the edges. Watercolor paint bleeding softly. Botanical illustration style. No text, no letters, no words — pure decorative background only.",
  modern:
    "Generate a minimalist modern invitation background. Clean stark design with bold geometric accents on pure white. One thin gold accent line. Maximum white space with subtle texture. Contemporary and sophisticated. No text, no letters, no words — pure decorative background only.",
  islamic:
    "Generate an Islamic geometric arabesque invitation background. Emerald green and gold colour palette. Intricate interlocking geometric star patterns and arabesque tessellations. Inspired by illuminated Islamic manuscripts. Sacred geometric borders. No text, no letters, no words — pure decorative background only.",
  christian_byzantine:
    "Generate a Byzantine-inspired Christian invitation background. Burgundy, antique gold, and midnight blue. Byzantine pointed-arch frames, gold-leaf mosaic textures, illuminated manuscript borders. Subtle olive branches and grapevines. Liturgical art aesthetic. No text, no letters, no words — pure decorative background only.",
  minimal:
    "Generate an ultra-minimalist invitation background. Almost entirely white with the most subtle thin hairline rules. A barely-visible accent element. Maximum negative space. Gallery-quality typographic print feel. No text, no letters, no words — pure decorative background only.",
  watercolor:
    "Generate an artistic watercolor invitation background. Loose expressive watercolor washes in soft blues, lavender, peach, and mint. Visible brushstrokes and organic paint shapes. Textured paper feel. Hand-painted keepsake quality. No text, no letters, no words — pure decorative background only.",
  gold_foil:
    "Generate a luxury gold foil invitation background. Metallic gold ornamental frames and borders on a dark marble or black velvet background. Gold catches light with subtle texture variation. Premium foil-stamped collectible feel. No text, no letters, no words — pure decorative background only.",
  celestial:
    "Generate a celestial-themed invitation background. Deep navy sky with scattered hand-painted gold stars, crescent moons, and gentle cosmic glow. Dreamlike, hopeful, and tender. Subtle gradient depth in the sky. No text, no letters, no words — pure decorative background only.",
  indian_traditional:
    "Generate an Indian traditional invitation background. Deep red, gold, and saffron colours. Intricate mandala borders, paisley patterns, lotus motifs, and temple-arch framing. Marigold garlands and diya glow. Festive and auspicious. No text, no letters, no words — pure decorative background only.",
  indo_arabic:
    "Generate an Indo-Islamic Mughal fusion invitation background. Emerald green, gold, and deep teal. Mughal pointed arches, jali lattice patterns, and floral arabesque. Inspired by Mughal miniature paintings. Rich jewel tones. No text, no letters, no words — pure decorative background only.",
  tropical_floral:
    "Generate a vibrant tropical floral invitation background. Coral, mango, and palm green colours. Lush hibiscus, plumeria, and sampaguita flowers with palm leaves and bright greenery. Warm sunlit energy. Joyful island-garden celebration feeling. No text, no letters, no words — pure decorative background only.",
};

/* ─── Main ─── */

async function main() {
  const requestedStyles = process.argv.slice(2);
  const styleIds =
    requestedStyles.length > 0
      ? requestedStyles
      : Object.keys(STYLE_GUIDES);

  console.log(`\n🎨 Generating style previews for: ${styleIds.join(", ")}\n`);

  const results: Record<string, string> = {};

  for (const styleId of styleIds) {
    const guide: StyleGuide | undefined = STYLE_GUIDES[styleId];
    if (!guide) {
      console.warn(`⚠ Unknown style "${styleId}", skipping`);
      continue;
    }

    const prompt =
      PREVIEW_PROMPTS[styleId] ??
      `Generate a beautiful ${guide.description} invitation background preview. Colors: ${guide.colors}. No text, no letters, no words — pure decorative background only.`;

    console.log(`⏳ Generating "${styleId}"...`);

    try {
      // Generate via Gemini
      const rawBuffer = await generateDesignImage({
        prompt,
        systemPrompt: guide.systemPrompt,
        aspectRatio: "4:5",
        imageSize: "1K",
      });

      // Convert to WebP
      const webpBuffer = await sharp(rawBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      // Upload to R2
      const key = `style-previews/${styleId}.webp`;
      const publicUrl = await uploadFile(key, webpBuffer, "image/webp");

      results[styleId] = publicUrl;
      console.log(`✅ ${styleId}: ${publicUrl}`);
    } catch (err) {
      console.error(
        `❌ Failed to generate "${styleId}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("\n── Results ──\n");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nDone. ${Object.keys(results).length}/${styleIds.length} generated.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

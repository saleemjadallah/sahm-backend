/**
 * Generate a Facebook cover photo for the Sahm page.
 *
 * Usage: npx tsx scripts/gen-fb-cover.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { generateDesignImage } from "../src/lib/ai/gemini.js";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROMPT = `Create a wide panoramic Facebook cover photo for "Sahm" (سهم), a premium AI photo studio brand.

COMPOSITION:
- Ultra-wide cinematic banner, 16:9 aspect ratio
- A rich mosaic collage of 5-6 overlapping design samples arranged across the width: a gold wedding invitation, an Islamic geometric wall art piece, a food photography flat lay, a fashion editorial shot, a real estate villa exterior, and a watercolor travel postcard
- Each sample is slightly angled/overlapping like a curated mood board, with subtle drop shadows
- Samples fade into an elegant dark navy (#0f1b3d) background at the edges

BRAND ELEMENTS:
- The center-left area has the text "سهم" in large elegant gold Arabic calligraphy (Ruqaa style)
- Below it in smaller tracked serif text: "SAHM"
- Subtle gold decorative line dividers and small diamond shapes near the logo
- A faint gold geometric pattern texture in the navy background

COLOR PALETTE:
- Deep navy (#0f1b3d) as the primary background
- Rich gold (#c9a96e) for accents, text, and decorative elements
- Warm cream (#fdf6e3) highlights
- Each sample brings its own colors but the overall palette stays cohesive

STYLE:
- Luxury editorial aesthetic, premium and warm
- NOT corporate or cold — culturally authentic for the Gulf region
- High-end magazine cover quality
- Clean and sophisticated with breathing room

IMPORTANT: This is a marketing banner. It should feel aspirational and showcase the breadth of what the studio creates.`;

async function main() {
  console.log("Generating Facebook cover photo...\n");

  const buffer = await generateDesignImage({
    prompt: PROMPT,
    aspectRatio: "16:9",
    imageSize: "2K",
  });

  const outPath = path.join(__dirname, "../../frontend/public/images/sahm-fb-cover.webp");
  writeFileSync(outPath, buffer);
  console.log(`✅ Saved to ${outPath}`);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});

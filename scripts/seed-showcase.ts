/**
 * Generate 12 showcase images (one per category) using the real generation pipeline.
 *
 * Usage:
 *   npx tsx scripts/seed-showcase.ts               # generate all 12
 *   npx tsx scripts/seed-showcase.ts event-stationery wall-art  # specific categories only
 *
 * Requires:
 *   - Database seeded with categories (npm run db:seed)
 *   - Env vars: GEMINI_API_KEY, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT, R2_PUBLIC_URL
 *   - A working DB connection (DATABASE_URL)
 *
 * Output:
 *   - Generates real images via the full Sahm pipeline (prompt builder → Gemini → R2)
 *   - Writes preview URLs to ../frontend/src/lib/config/showcase-designs.json
 *   - Creates generations under a dedicated "showcase" system user
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { generateSingle } from "../src/services/generation.service.js";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileSync, readFileSync } from "fs";
import type { GenerateRequest } from "../src/types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

/* ─── Showcase requests — one per category with representative metadata ─── */

const SHOWCASE_REQUESTS: GenerateRequest[] = [
  {
    categoryId: "event-stationery",
    style: "royal",
    metadata: {
      eventType: "wedding",
      names: "Ahmed & Layla",
      venue: "The Ritz-Carlton, Dubai",
      colorScheme: "#d4a853",
    },
    userPrompt: "Elegant gold and navy wedding invitation suite with Arabic calligraphy accents",
  },
  {
    categoryId: "wall-art",
    style: "islamic",
    metadata: {
      artStyle: "geometric",
      roomType: "living_room",
      colorScheme: "#1a5e3a",
    },
    userPrompt: "Intricate Islamic geometric pattern wall art in emerald green and gold, inspired by Alhambra mosaic tiles",
  },
  {
    categoryId: "greeting-cards",
    style: "floral",
    metadata: {
      occasion: "birthday",
      recipientRelation: "friend",
    },
    userPrompt: "Watercolor floral birthday card with soft pink roses and sage green leaves",
  },
  {
    categoryId: "social-media",
    style: "modern",
    metadata: {
      platform: "instagram",
      contentType: "announcement",
    },
    userPrompt: "Clean modern Instagram post template for a luxury brand product launch announcement",
  },
  {
    categoryId: "food-restaurant",
    style: "modern",
    metadata: {
      cuisineType: "middle_eastern",
      shotType: "overhead",
    },
    userPrompt: "Overhead flat lay of an elegant Middle Eastern mezze spread with hummus, falafel, fresh herbs, and warm bread on a rustic ceramic platter",
  },
  {
    categoryId: "business",
    style: "minimal",
    metadata: {
      materialType: "business_card",
      industry: "finance",
    },
    userPrompt: "Premium minimalist business card design with gold foil details on heavyweight white stock",
  },
  {
    categoryId: "real-estate",
    style: "modern",
    metadata: {
      propertyType: "luxury_villa",
      roomType: "exterior",
    },
    userPrompt: "Luxury modern villa exterior at golden hour with infinity pool overlooking Dubai skyline",
  },
  {
    categoryId: "fashion",
    style: "modern",
    metadata: {
      garmentType: "abaya",
      shotType: "editorial",
    },
    userPrompt: "High-fashion editorial shot of an embroidered black abaya with gold thread detailing, dramatic lighting against a minimal backdrop",
  },
  {
    categoryId: "portraits",
    style: "watercolor",
    metadata: {
      portraitType: "artistic",
      style: "painted",
    },
    userPrompt: "Elegant watercolor portrait illustration with soft washes and flowing brushstrokes, warm earth tones",
  },
  {
    categoryId: "religious-art",
    style: "islamic",
    metadata: {
      artType: "geometric",
      theme: "spiritual",
    },
    userPrompt: "Serene Islamic geometric art with interlocking star patterns in emerald green and gold, peaceful spiritual atmosphere with soft ambient light",
  },
  {
    categoryId: "education",
    style: "modern",
    metadata: {
      materialType: "certificate",
      level: "university",
    },
    userPrompt: "Elegant academic certificate of achievement with gold seal and ornamental border, modern yet classic design",
  },
  {
    categoryId: "travel",
    style: "watercolor",
    metadata: {
      destination: "santorini",
      contentType: "postcard",
    },
    userPrompt: "Dreamy watercolor travel postcard of white-washed Santorini buildings with blue domes overlooking the Aegean Sea at sunset",
  },
];

/* ─── Main ─── */

async function main() {
  const filterSlugs = process.argv.slice(2);
  const requests = filterSlugs.length
    ? SHOWCASE_REQUESTS.filter((r) => filterSlugs.includes(r.categoryId))
    : SHOWCASE_REQUESTS;

  console.log(`\n🎨 Generating ${requests.length} showcase images...\n`);

  // Ensure a system user for showcase images
  const showcaseUser = await prisma.user.upsert({
    where: { email: "showcase@sahm.app" },
    update: {},
    create: {
      email: "showcase@sahm.app",
      name: "Sahm Showcase",
      locale: "en",
    },
  });

  console.log(`  System user: ${showcaseUser.id} (${showcaseUser.email})\n`);

  // Load existing showcase config if doing partial regeneration
  const outputPath = path.resolve(
    __dirname,
    "../../frontend/src/lib/config/showcase-designs.json",
  );

  let existing: Record<string, { previewUrl: string; generationId: string }> = {};
  try {
    existing = JSON.parse(readFileSync(outputPath, "utf-8"));
  } catch {
    // First run — start fresh
  }

  // Generate each image sequentially (respect Gemini rate limits)
  for (const req of requests) {
    const slug = req.categoryId;
    console.log(`  ⏳ ${slug}...`);

    try {
      const generation = await generateSingle(prisma, showcaseUser.id, req);

      if (generation.status === "COMPLETED" && generation.previewUrl) {
        existing[slug] = {
          previewUrl: generation.previewUrl,
          generationId: generation.id,
        };
        console.log(`  ✅ ${slug} → ${generation.previewUrl}`);
      } else {
        console.log(`  ⚠️  ${slug} finished with status: ${generation.status}`);
      }
    } catch (err) {
      console.error(
        `  ❌ ${slug} failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2_000));
  }

  // Write output JSON
  writeFileSync(outputPath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`\n✨ Wrote showcase config to:\n   ${outputPath}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

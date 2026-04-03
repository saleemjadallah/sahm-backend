import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { getObjectBuffer, uploadBuffer } from "../lib/storage.js";
import { assembleStorybookPdf, type StorybookPage } from "../lib/storybook-pdf.js";
import { Semaphore } from "../lib/semaphore.js";

const gemini = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : null;
const semaphore = new Semaphore(env.GEMINI_MAX_CONCURRENT);

const STORYBOOK_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

type ReferencePhoto = { mimeType: string; buffer: Buffer };

/* ── 5-page scene definitions ──────────────────────────── */

const SCENES = [
  {
    id: "cover",
    titleTemplate: "A Day in {name}'s Life",
    sceneDescription:
      "The pet sitting proudly in warm morning light, looking at the viewer. A gentle title-page composition with a soft golden background.",
  },
  {
    id: "morning",
    titleTemplate: "Good morning, {name}.",
    sceneDescription:
      "The pet waking up and stretching on their favorite spot, then eagerly approaching breakfast. " +
      "Early morning sunlight streaming through a window, a cozy domestic scene.",
  },
  {
    id: "adventure",
    titleTemplate: "The best part of the day.",
    sceneDescription:
      "The pet outside on a joyful adventure — running through grass, playing with a favorite toy, " +
      "or exploring a sun-dappled park. Mid-morning light, green and warm, full of energy and happiness.",
  },
  {
    id: "together",
    titleTemplate: "{name} always made friends.",
    sceneDescription:
      "The pet sharing a quiet, warm moment with their human — being held, cuddled on the couch, " +
      "or resting in a lap. Show only human hands or silhouette, NO detailed human faces. " +
      "Late afternoon golden light. The emotional heart of the story.",
  },
  {
    id: "goodnight",
    titleTemplate: "Goodnight, sweet {name}.",
    sceneDescription:
      "The pet sleeping peacefully — curled up with a soft blanket or on a favorite pillow. " +
      "Gentle moonlight or warm lamp glow. The tender, peaceful close of a perfect day.",
  },
] as const;

const PAGE_COUNT = SCENES.length;

/* ── Character block builder ───────────────────────────── */

function buildCharacterBlock(pet: {
  name: string;
  type: string;
  breed?: string | null;
  description?: string | null;
}): string {
  const breedLine = pet.breed ? `a ${pet.breed} ${pet.type.toLowerCase()}` : `a ${pet.type.toLowerCase()}`;
  return [
    "CHARACTER IDENTITY (MUST be consistent across ALL pages):",
    `This is ${pet.name}, ${breedLine}.`,
    pet.description ? `Key physical features: ${pet.description}.` : "",
    "",
    "You MUST reproduce this exact animal in every illustration. Study the reference photos carefully.",
    "The animal's physical appearance is the HIGHEST priority — same markings, ear position, body proportions.",
    "The character MUST have the same face, fur pattern, and coloring as shown in the anchor image.",
    "Artistic style applies to the scene and rendering technique — NEVER to the animal's anatomy.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ── Story text generation ─────────────────────────────── */

type StoryPageText = { page: number; title: string; body: string };

async function generateStoryText(pet: {
  name: string;
  type: string;
  breed?: string | null;
  personalityTraits?: string[];
  funnyHabits?: string | null;
  favoriteThings?: string | null;
  description?: string | null;
}): Promise<StoryPageText[]> {
  const traitsStr = pet.personalityTraits?.length ? pet.personalityTraits.join(", ") : "loving";
  const habitsStr = pet.funnyHabits || "had endearing little habits";
  const favoritesStr = pet.favoriteThings || "loved the simple things";
  const breedStr = pet.breed ? `${pet.breed} ${pet.type.toLowerCase()}` : pet.type.toLowerCase();

  const prompt = `You are writing the text for a 5-page illustrated storybook about a beloved pet named ${pet.name}.
This pet has passed away, and the storybook celebrates a perfect day in their life.
The tone is warm, gentle, and celebratory — not sad. Think of it as a love letter.

Pet details:
- Name: ${pet.name}
- Type: ${breedStr}
- Personality traits: ${traitsStr}
- Funny habits: ${habitsStr}
- Favorite things: ${favoritesStr}
- Description: ${pet.description || "a beautiful and beloved pet"}

Write text for exactly 5 pages. Each page should have:
1. A short title (3-7 words)
2. Body text (2-4 short sentences, 20-50 words total)

The story follows this arc:
Page 1 (Cover): Introduce ${pet.name} — who they were, what made them special.
Page 2 (Morning): ${pet.name} waking up, breakfast, the cozy start of a perfect day.
Page 3 (Adventure): ${pet.name} outside playing, exploring, at their happiest.
Page 4 (Together): ${pet.name} with the people they loved — cuddles, quiet warmth.
Page 5 (Goodnight): ${pet.name} falling asleep peacefully. The gentle close.

Rules:
- Use ${pet.name} by name in every page.
- Weave in specific personality details naturally — don't list them.
- Keep the language simple and warm, like a children's book for adults.
- The last page should be emotionally resonant but gentle — a farewell, not a goodbye.
- Do NOT use cliches like "rainbow bridge" or "forever in our hearts".

Return the result as a JSON array of 5 objects:
[{ "page": 1, "title": "...", "body": "..." }, ...]

Return ONLY the JSON array. No markdown, no explanation.`;

  if (!gemini) {
    return SCENES.map((scene, i) => ({
      page: i + 1,
      title: scene.titleTemplate.replace("{name}", pet.name),
      body: `${pet.name} was always full of love. Every moment was a treasure.`,
    }));
  }

  const response = await gemini.models.generateContent({
    model: env.GEMINI_TEXT_MODEL,
    contents: prompt,
    config: { temperature: 0.8, maxOutputTokens: 1500 },
  });

  const text = response.text?.trim() ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Gemini did not return valid JSON for story text.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as StoryPageText[];
  if (!Array.isArray(parsed) || parsed.length < PAGE_COUNT) {
    throw new Error(`Expected ${PAGE_COUNT} story pages, got ${parsed.length}.`);
  }

  return parsed.slice(0, PAGE_COUNT);
}

/* ── Scene illustration prompt builder ─────────────────── */

function buildScenePrompt(
  scene: (typeof SCENES)[number],
  pageText: StoryPageText,
  petName: string,
  characterBlock: string,
  pageIndex: number,
  isAnchor: boolean,
): string {
  const anchorNote = isAnchor
    ? `This is page 1 — the ANCHOR illustration. Establish the character's exact appearance in the storybook watercolor style. All subsequent pages will reference this image for consistency.`
    : `This is page ${pageIndex + 1} of ${PAGE_COUNT}. The pet MUST look exactly like the anchor image (page 1). Same markings, same ear position, same body proportions. Only the pose and setting change.`;

  return `${characterBlock}

SCENE: ${pageText.title}
${scene.sceneDescription}

STYLE: Warm watercolor storybook illustration. Soft edges, visible paper texture, hand-painted quality.
Warm golden color palette. No text in the image. No human faces (hands and silhouettes only).
The illustration should feel like a page from a premium children's book.

COMPOSITION: Landscape orientation, approximately 16:9 aspect ratio. ${petName} is the clear focal point.
Scene elements support the mood without competing for attention.
Leave clear space in the bottom 30% of the image for text overlay — keep that area lighter or less detailed.

${anchorNote}`;
}

/* ── Image generation via Gemini ───────────────────────── */

async function generateIllustration(
  prompt: string,
  references: ReferencePhoto[],
): Promise<Buffer> {
  if (!gemini) {
    // Demo placeholder
    return sharp({
      create: { width: 1200, height: 675, channels: 3, background: { r: 253, g: 246, b: 236 } },
    })
      .png()
      .toBuffer();
  }

  const contents = [
    ...references.map((ref) => ({
      inlineData: {
        data: ref.buffer.toString("base64"),
        mimeType: ref.mimeType,
      },
    })),
    { text: prompt },
  ];

  const response = await Promise.race([
    gemini.models.generateContent({
      model: STORYBOOK_IMAGE_MODEL,
      contents,
      config: {
        responseModalities: ["Image"],
      },
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Illustration generation timed out.")), 120_000);
    }),
  ]);

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data,
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini did not return an illustration.");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

/* ── Reference photo loader ────────────────────────────── */

async function loadReferences(
  photos: Array<{ processedKey: string | null; originalKey: string }>,
): Promise<ReferencePhoto[]> {
  const refs: ReferencePhoto[] = [];
  for (const photo of photos) {
    const buffer = await getObjectBuffer(photo.processedKey ?? photo.originalKey).catch(() => null);
    if (buffer) {
      refs.push({ buffer, mimeType: "image/png" });
    }
  }
  return refs;
}

/* ── Main orchestrator ─────────────────────────────────── */

/** Generate "A Day In Their Life" storybook for the given order add-on. */
export async function generateStorybook(orderId: string, addOnId: string) {
  const addOn = await prisma.orderAddOn.findUniqueOrThrow({
    where: { id: addOnId },
    include: {
      order: {
        include: {
          pet: { include: { photos: { orderBy: { createdAt: "asc" } } } },
        },
      },
    },
  });

  const { pet } = addOn.order;
  const references = await loadReferences(pet.photos);
  const characterBlock = buildCharacterBlock(pet);

  // ── Step 1: Generate story text (~3s) ──
  await updateProgress(addOnId, "text", 0);

  let storyPages: StoryPageText[];
  try {
    storyPages = await generateStoryText(pet);
  } catch {
    storyPages = SCENES.map((scene, i) => ({
      page: i + 1,
      title: scene.titleTemplate.replace("{name}", pet.name),
      body: `${pet.name} made every moment special. What a perfect day.`,
    }));
  }

  // ── Step 2: Generate page 1 as ANCHOR (~30s) ──
  // The anchor establishes the pet's appearance in the storybook art style.
  // All subsequent pages reference this anchor for character consistency.
  await updateProgress(addOnId, "anchor", 0, storyPages);

  const anchorPrompt = buildScenePrompt(
    SCENES[0], storyPages[0], pet.name, characterBlock, 0, true,
  );

  let anchorBuffer: Buffer | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      anchorBuffer = await semaphore.use(() =>
        generateIllustration(anchorPrompt, references),
      );
      break;
    } catch {
      // Retry
    }
  }

  const illustrationBuffers: (Buffer | null)[] = new Array(PAGE_COUNT).fill(null);
  illustrationBuffers[0] = anchorBuffer;
  await updateProgress(addOnId, "illustrations", anchorBuffer ? 1 : 0, storyPages);

  // ── Step 3: Generate pages 2-5 in parallel, each referencing the anchor ──
  // Include pet photos + anchor image as references for consistency
  const anchorReferences: ReferencePhoto[] = [...references];
  if (anchorBuffer) {
    anchorReferences.push({ buffer: anchorBuffer, mimeType: "image/png" });
  }

  let pagesCompleted = anchorBuffer ? 1 : 0;

  await Promise.all(
    SCENES.slice(1).map((scene, idx) => {
      const pageIndex = idx + 1;
      return semaphore.use(async () => {
        const prompt = buildScenePrompt(
          scene, storyPages[pageIndex], pet.name, characterBlock, pageIndex, false,
        );

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            illustrationBuffers[pageIndex] = await generateIllustration(prompt, anchorReferences);
            pagesCompleted++;
            await updateProgress(addOnId, "illustrations", pagesCompleted, storyPages);
            break;
          } catch {
            // Retry
          }
        }
      });
    }),
  );

  // ── Step 4: Check completion — every illustrated page must succeed ──
  const successCount = illustrationBuffers.filter(Boolean).length;
  if (successCount < PAGE_COUNT) {
    throw new Error(`Only ${successCount}/${PAGE_COUNT} storybook pages generated.`);
  }

  // ── Step 5: Assemble PDF ──
  await updateProgress(addOnId, "assembling", PAGE_COUNT, storyPages);

  const pdfPages: StorybookPage[] = storyPages.map((page, index) => ({
    imageBuffer: illustrationBuffers[index]!,
    title: page.title,
    body: page.body,
  }));

  const pdfBuffer = await assembleStorybookPdf(pdfPages, pet.name);

  // ── Step 6: Upload PDF + cover preview ──
  const pdfKey = `addons/${orderId}/${addOnId}/storybook.pdf`;
  const uploaded = await uploadBuffer(pdfKey, pdfBuffer, "application/pdf");

  let coverPreviewUrl: string | undefined;
  let coverPreviewKey: string | undefined;
  if (illustrationBuffers[0]) {
    try {
      const coverBuffer = await sharp(illustrationBuffers[0])
        .resize(800, 450, { fit: "cover" })
        .png()
        .toBuffer();
      const coverKeyPath = `addons/${orderId}/${addOnId}/cover-preview.png`;
      const coverUploaded = await uploadBuffer(coverKeyPath, coverBuffer, "image/png");
      coverPreviewUrl = coverUploaded.url;
      coverPreviewKey = coverUploaded.key;
    } catch {
      // Cover preview is optional
    }
  }

  // ── Step 7: Mark complete ──
  await prisma.orderAddOn.update({
    where: { id: addOnId },
    data: {
      status: "COMPLETED",
      documentUrl: uploaded.url,
      documentKey: uploaded.key,
      previewUrl: coverPreviewUrl ?? null,
      previewKey: coverPreviewKey ?? null,
      metadata: { stage: "completed", pagesCompleted: PAGE_COUNT, pagesTotal: PAGE_COUNT },
    },
  });
}

/* ── Progress helper ───────────────────────────────────── */

async function updateProgress(
  addOnId: string,
  stage: string,
  pagesCompleted: number,
  storyText?: StoryPageText[],
) {
  await prisma.orderAddOn.update({
    where: { id: addOnId },
    data: {
      metadata: {
        stage,
        pagesCompleted,
        pagesTotal: PAGE_COUNT,
        ...(storyText ? { storyText } : {}),
      },
    },
  });
}

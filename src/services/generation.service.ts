import type { PrismaClient, Generation } from "@prisma/client";
import { generateDesignImage, type GenerateImageOpts } from "../lib/ai/gemini.js";
import { buildGenerationPrompt } from "../lib/ai/prompts.js";
import { getCategory } from "../lib/categories/index.js";
import { processGeneratedImage } from "./image.service.js";
import { debitCreditsInTransaction } from "./credit.service.js";
import { NotFoundError, GeminiError, ValidationError } from "../errors/index.js";
import type {
  CategoryPromptConfig,
  CategoryOutputSpecs,
  CategoryOutputFormat,
} from "../lib/categories/seed-data.js";
import type { GenerateRequest, CreatePackRequest } from "../types/index.js";

const GEMINI_TIMEOUT_MS = 180_000;
const STORAGE_TIMEOUT_MS = 60_000;

/**
 * Generate a single image. The main entry point.
 */
export async function generateSingle(
  prisma: PrismaClient,
  userId: string,
  req: GenerateRequest,
): Promise<Generation> {
  const {
    categoryId,
    subcategoryId,
    userPrompt,
    style,
    aspectRatio,
    outputFormatId,
    metadata,
    promptVariant,
  } = req;

  // Load category config
  const category = await getCategory(prisma, categoryId);
  if (!category) throw new NotFoundError("Category");

  const subcategory = subcategoryId
    ? category.subcategories.find((s) => s.id === subcategoryId) ?? null
    : null;

  const promptConfig = category.promptConfig as unknown as CategoryPromptConfig;
  const outputSpecs = category.outputSpecs as unknown as CategoryOutputSpecs | null;
  const resolvedStyle = style || "modern";
  assertStyleAllowed(category.styleOptions as string[] | null, resolvedStyle, category.id);
  const selectedOutputFormat = resolveOutputFormat(outputSpecs, outputFormatId, aspectRatio);
  const resolvedAspect =
    aspectRatio
    || selectedOutputFormat?.aspectRatio
    || subcategory?.defaultAspect
    || outputSpecs?.defaultAspectRatio
    || "1:1";
  const resolvedResolution =
    selectedOutputFormat?.resolution || outputSpecs?.defaultResolution || "2k";

  // Determine the cost to unlock download/share/export after generation completes.
  const creditsCost =
    selectedOutputFormat?.creditsCost
    ?? (resolvedResolution.toLowerCase() === "4k" ? 2 : 1);

  // Create generation record
  const generation = await prisma.generation.create({
    data: {
      userId,
      categoryId,
      subcategoryId: subcategory?.id,
      userPrompt,
      style: resolvedStyle,
      aspectRatio: resolvedAspect,
      metadata: metadata as object,
      status: "GENERATING",
      creditsCost,
    },
  });

  // Build prompt
  const prompt = buildGenerationPrompt(
    promptConfig,
    subcategory?.promptTemplate ?? null,
    userPrompt ?? null,
    resolvedStyle,
    metadata ?? null,
    resolvedAspect,
    {
      categoryId,
      subcategoryId: subcategory?.id,
      outputFormatId: selectedOutputFormat?.id,
      promptVariant,
      outputFormatLabel: selectedOutputFormat?.label,
      outputFormatDescription: selectedOutputFormat?.description,
      outputFormatPromptHint: selectedOutputFormat?.promptHint,
      outputResolution: resolvedResolution,
      supportsTextOverlay: outputSpecs?.supportsTextOverlay,
    },
  );

  // Update record with resolved prompt (include variant ID for tracking)
  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      resolvedPrompt: prompt.variantId
        ? `[variant:${prompt.variantId}] ${prompt.contentPrompt}`
        : prompt.contentPrompt,
    },
  });

  // Generate image async (don't await in the request cycle for real usage,
  // but for now we do synchronous generation)
  try {
    const imageBuffer = await withTimeout(
      generateDesignImage({
        prompt: prompt.contentPrompt,
        systemPrompt: prompt.systemPrompt,
        aspectRatio: resolvedAspect,
      }),
      GEMINI_TIMEOUT_MS,
      `Gemini generation timed out for ${generation.id}`,
    );

    const { previewUrl, fullUrl } = await withTimeout(
      processGeneratedImage(imageBuffer, generation.id, `gen/${userId}`),
      STORAGE_TIMEOUT_MS,
      `Image upload timed out for ${generation.id}`,
    );

    return prisma.generation.update({
      where: { id: generation.id },
      data: { previewUrl, fullUrl, status: "COMPLETED" },
    });
  } catch (err) {
    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "FAILED" },
    });

    throw new GeminiError("Failed to generate image", {
      generationId: generation.id,
      originalError: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Generate a coordinated pack of images.
 * First image is the "hero" — used as style reference for the rest.
 */
export async function generatePack(
  prisma: PrismaClient,
  userId: string,
  req: CreatePackRequest,
): Promise<{ packId: string; generations: Generation[] }> {
  const { categoryId, items, style, metadata } = req;

  if (!items.length) throw new ValidationError("Pack must contain at least one item");

  const category = await getCategory(prisma, categoryId);
  if (!category) throw new NotFoundError("Category");

  const promptConfig = category.promptConfig as unknown as CategoryPromptConfig;
  const outputSpecs = category.outputSpecs as unknown as CategoryOutputSpecs | null;
  const resolvedStyle = style || "modern";
  assertStyleAllowed(category.styleOptions as string[] | null, resolvedStyle, category.id);
  // Create pack
  const pack = await prisma.pack.create({
    data: {
      userId,
      categoryId,
      label: `${category.label} Pack`,
      style: resolvedStyle,
      metadata: metadata as object,
    },
  });

  // Create generation records
  const generations: Generation[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const subcategory = item.subcategoryId
      ? category.subcategories.find((s) => s.id === item.subcategoryId) ?? null
      : null;
    const aspect =
      subcategory?.defaultAspect || outputSpecs?.defaultAspectRatio || "1:1";

    const gen = await prisma.generation.create({
      data: {
        userId,
        categoryId,
        subcategoryId: subcategory?.id,
        userPrompt: item.userPrompt,
        style: resolvedStyle,
        aspectRatio: aspect,
        metadata: item.metadata as object,
        status: "PENDING",
        creditsCost: 1,
        packId: pack.id,
        packRole: i === 0 ? "hero" : `companion-${i}`,
      },
    });
    generations.push(gen);
  }

  // Generate hero first
  const heroGen = generations[0];
  const heroSubcat = heroGen.subcategoryId
    ? category.subcategories.find((s) => s.id === heroGen.subcategoryId) ?? null
    : null;
  const heroPrompt = buildGenerationPrompt(
    promptConfig,
    heroSubcat?.promptTemplate ?? null,
    heroGen.userPrompt,
    resolvedStyle,
    (heroGen.metadata as Record<string, unknown>) ?? null,
    heroGen.aspectRatio,
    {
      categoryId: category.id,
      subcategoryId: heroSubcat?.id,
      outputResolution: outputSpecs?.defaultResolution,
      supportsTextOverlay: outputSpecs?.supportsTextOverlay,
    },
  );

  let heroBuffer: Buffer | undefined;
  try {
    await prisma.generation.update({ where: { id: heroGen.id }, data: { status: "GENERATING", resolvedPrompt: heroPrompt.contentPrompt } });

    heroBuffer = await withTimeout(
      generateDesignImage({
        prompt: heroPrompt.contentPrompt,
        systemPrompt: heroPrompt.systemPrompt,
        aspectRatio: heroGen.aspectRatio,
        imageSize: "4K",
      }),
      GEMINI_TIMEOUT_MS,
      `Hero generation timed out`,
    );

    const { previewUrl, fullUrl } = await withTimeout(
      processGeneratedImage(heroBuffer, heroGen.id, `gen/${userId}`),
      STORAGE_TIMEOUT_MS,
      `Hero upload timed out`,
    );

    generations[0] = await prisma.generation.update({
      where: { id: heroGen.id },
      data: { previewUrl, fullUrl, status: "COMPLETED" },
    });
  } catch (err) {
    await prisma.generation.update({ where: { id: heroGen.id }, data: { status: "FAILED" } });
    console.error(`[pack] hero generation failed:`, err);
  }

  // Generate rest in parallel with hero as style reference
  const restResults = await Promise.allSettled(
    generations.slice(1).map(async (gen, idx) => {
      const subcat = gen.subcategoryId
        ? category.subcategories.find((s) => s.id === gen.subcategoryId) ?? null
        : null;
      const prompt = buildGenerationPrompt(
        promptConfig,
        subcat?.promptTemplate ?? null,
        gen.userPrompt,
        resolvedStyle,
        (gen.metadata as Record<string, unknown>) ?? null,
        gen.aspectRatio,
        {
          categoryId: category.id,
          subcategoryId: subcat?.id,
          promptVariant: heroPrompt.variantId,
          outputResolution: outputSpecs?.defaultResolution,
          supportsTextOverlay: outputSpecs?.supportsTextOverlay,
        },
      );

      const styleRef = heroBuffer
        ? "\n\nSTYLE REFERENCE: Match the attached reference image's color palette, lighting, material treatment, and overall art direction exactly. Preserve decorative motifs or typography only when they are appropriate to the requested deliverable. Only the layout and content should differ."
        : "";

      await prisma.generation.update({ where: { id: gen.id }, data: { status: "GENERATING", resolvedPrompt: prompt.contentPrompt } });

      try {
        const opts: GenerateImageOpts = {
          prompt: prompt.contentPrompt + styleRef,
          systemPrompt: prompt.systemPrompt,
          aspectRatio: gen.aspectRatio,
          referenceImage: heroBuffer,
        };

        const imageBuffer = await withTimeout(
          generateDesignImage(opts),
          GEMINI_TIMEOUT_MS,
          `Pack item ${idx + 1} timed out`,
        );

        const { previewUrl, fullUrl } = await withTimeout(
          processGeneratedImage(imageBuffer, gen.id, `gen/${userId}`),
          STORAGE_TIMEOUT_MS,
          `Pack item ${idx + 1} upload timed out`,
        );

        return prisma.generation.update({
          where: { id: gen.id },
          data: { previewUrl, fullUrl, status: "COMPLETED" },
        });
      } catch (err) {
        await prisma.generation.update({ where: { id: gen.id }, data: { status: "FAILED" } });
        throw err;
      }
    }),
  );

  // Collect final state
  const finalGenerations = await prisma.generation.findMany({
    where: { packId: pack.id },
    orderBy: { createdAt: "asc" },
  });

  return { packId: pack.id, generations: finalGenerations };
}

/**
 * Regenerate a single generation with optional new style/prompt.
 */
export async function regenerateGeneration(
  prisma: PrismaClient,
  userId: string,
  generationId: string,
  newStyle?: string,
  newPrompt?: string,
): Promise<Generation> {
  const generation = await prisma.generation.findFirst({
    where: { id: generationId, userId },
  });
  if (!generation) throw new NotFoundError("Generation");

  const category = await getCategory(prisma, generation.categoryId);
  if (!category) throw new NotFoundError("Category");

  const promptConfig = category.promptConfig as unknown as CategoryPromptConfig;
  const outputSpecs = category.outputSpecs as unknown as CategoryOutputSpecs | null;
  const subcategory = generation.subcategoryId
    ? category.subcategories.find((s) => s.id === generation.subcategoryId) ?? null
    : null;

  const resolvedStyle = newStyle || generation.style || "modern";
  assertStyleAllowed(category.styleOptions as string[] | null, resolvedStyle, category.id);
  await prisma.generation.update({
    where: { id: generationId },
    data: { status: "GENERATING", style: resolvedStyle },
  });

  const prompt = buildGenerationPrompt(
    promptConfig,
    subcategory?.promptTemplate ?? null,
    newPrompt ?? generation.userPrompt,
    resolvedStyle,
    (generation.metadata as Record<string, unknown>) ?? null,
    generation.aspectRatio,
    {
      categoryId: generation.categoryId,
      subcategoryId: subcategory?.id,
      outputFormatId: undefined,
      outputResolution: outputSpecs?.defaultResolution,
      supportsTextOverlay: outputSpecs?.supportsTextOverlay,
    },
  );

  try {
    const imageBuffer = await withTimeout(
      generateDesignImage({
        prompt: prompt.contentPrompt,
        systemPrompt: prompt.systemPrompt,
        aspectRatio: generation.aspectRatio,
      }),
      GEMINI_TIMEOUT_MS,
      `Regeneration timed out for ${generationId}`,
    );

    const { previewUrl, fullUrl } = await withTimeout(
      processGeneratedImage(imageBuffer, generationId, `gen/${userId}`),
      STORAGE_TIMEOUT_MS,
      `Upload timed out for ${generationId}`,
    );

    return prisma.generation.update({
      where: { id: generationId },
      data: {
        previewUrl,
        fullUrl,
        status: "COMPLETED",
        isDownloaded: false,
        resolvedPrompt: prompt.contentPrompt,
        style: resolvedStyle,
        userPrompt: newPrompt ?? generation.userPrompt,
      },
    });
  } catch (err) {
    await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } });

    throw new GeminiError("Failed to regenerate image", {
      generationId,
      originalError: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function unlockGenerationExport(
  prisma: PrismaClient,
  userId: string,
  generationId: string,
): Promise<Generation> {
  return prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findFirst({
      where: { id: generationId, userId },
    });

    if (!generation) throw new NotFoundError("Generation");
    if (generation.status !== "COMPLETED" || !generation.fullUrl) {
      throw new ValidationError("Generation is not ready to unlock for export");
    }

    if (generation.isDownloaded) {
      return generation;
    }

    if (generation.creditsCost > 0) {
      await debitCreditsInTransaction(
        tx,
        userId,
        generation.creditsCost,
        "GENERATION",
        generation.id,
        `Unlock export for ${generation.id}`,
      );
    }

    return tx.generation.update({
      where: { id: generation.id },
      data: { isDownloaded: true },
    });
  });
}

function resolveOutputFormat(
  outputSpecs: CategoryOutputSpecs | null,
  requestedFormatId?: string,
  requestedAspectRatio?: string,
): CategoryOutputFormat | null {
  if (!outputSpecs?.formats?.length) return null;

  if (requestedFormatId) {
    const byId = outputSpecs.formats.find((format) => format.id === requestedFormatId);
    if (byId) return byId;
  }

  if (requestedAspectRatio) {
    const byAspect = outputSpecs.formats.find(
      (format) => format.aspectRatio === requestedAspectRatio,
    );
    if (byAspect) return byAspect;
  }

  return (
    outputSpecs.formats.find((format) => format.id === outputSpecs.defaultFormatId)
    || outputSpecs.formats[0]
    || null
  );
}

function assertStyleAllowed(
  styleOptions: string[] | null,
  style: string,
  categoryId: string,
): void {
  if (!styleOptions?.length) return;
  if (styleOptions.includes(style)) return;

  throw new ValidationError(
    `Style '${style}' is not supported for category '${categoryId}'`,
    { categoryId, style, allowedStyles: styleOptions },
  );
}

// ─── Utility ──────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

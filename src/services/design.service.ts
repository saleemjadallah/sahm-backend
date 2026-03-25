import type { PrismaClient, Project, Design, DesignType } from "@prisma/client";
import { generateDesignImage, type GenerateImageOpts } from "../lib/ai/gemini.js";
import { buildDesignPrompt, type DesignPrompt } from "../lib/ai/prompts.js";
import { LAYOUT_GUIDES } from "../lib/ai/layout-guides.js";
import { processGeneratedImage } from "./image.service.js";
import { clearTextZones, compositeText } from "../lib/text/compositor.js";
import { NotFoundError, GeminiError } from "../errors/index.js";
import { resolveSuitePack } from "../lib/ai/suite-packs.js";

interface TextContent {
  [fieldName: string]: Record<string, string>;
}

// Hero design types get 4K resolution; everything else gets 2K
const HERO_SIZE = "4K" as const;
const STANDARD_SIZE = "2K" as const;
const GEMINI_TIMEOUT_MS = 180_000;
const STORAGE_TIMEOUT_MS = 60_000;

/**
 * Generate the full design suite for a project.
 * Uses hero-first strategy: generates the hero piece first,
 * then passes it as a style reference to all subsequent pieces.
 */
export async function generateSuite(
  prisma: PrismaClient,
  projectId: string,
): Promise<Design[]> {
  console.info(`[design] generateSuite:start projectId=${projectId}`);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project");

  const pack = resolveSuitePack(project.type, project.metadata as Record<string, unknown> | null);
  if (!pack.designTypes.length) {
    throw new GeminiError(`No design types configured for project type: ${project.type}`);
  }

  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = (metadata?.style as string) || "modern";
  const textContent = buildTextContent(project, metadata);

  // Build prompts for every design type
  const pieces = pack.designTypes.map((designType) => {
    const layout = LAYOUT_GUIDES[designType];
    const prompt = buildDesignPrompt(project.type, designType, style, textContent, languages, metadata);
    return { designType, layout, prompt, aspectRatio: layout?.aspectRatio || "1:1", textFree: prompt.textFree };
  });

  // Separate hero from the rest
  const heroIdx = pieces.findIndex((p) => p.designType === pack.heroDesignType);
  const heroSpec = heroIdx >= 0 ? pieces[heroIdx] : pieces[0];
  const restSpecs = pieces.filter((_, i) => i !== (heroIdx >= 0 ? heroIdx : 0));

  console.info(
    `[design] generateSuite:pack projectId=${projectId} hero=${heroSpec.designType} total=${pieces.length}`,
  );

  // Create all design records up front as PENDING
  const designRecords = await Promise.all(
    pieces.map((p) =>
      prisma.design.create({
        data: {
          projectId: project.id,
          designType: p.designType as DesignType,
          style,
          previewUrl: "",
          prompt: p.prompt.contentPrompt,
          aspectRatio: p.aspectRatio,
          generationStatus: "PENDING",
          textContent: textContent as object,
        },
      }),
    ),
  );

  // Map designType -> record for easy lookup
  const recordByType = new Map(designRecords.map((r) => [r.designType, r]));

  // ── Step 1: Generate hero piece ──
  const heroRecord = recordByType.get(heroSpec.designType)!;
  const { design: heroDesign, rawBuffer: heroBuffer } = await generateOne(
    prisma, heroRecord, project.id,
    { prompt: heroSpec.prompt.contentPrompt, systemPrompt: heroSpec.prompt.systemPrompt, aspectRatio: heroSpec.aspectRatio, imageSize: HERO_SIZE },
    {
      textFree: heroSpec.textFree,
      designType: heroSpec.designType,
      textContent,
      languages,
    },
  );

  // ── Step 2: Generate remaining pieces with hero as style reference ──
  const restResults = await Promise.allSettled(
    restSpecs.map((spec) => {
      const record = recordByType.get(spec.designType)!;
      const suitePrompt = spec.prompt.contentPrompt
        + "\n\nSTYLE REFERENCE: Match the attached reference image's color palette, borders, motifs, and typography mood exactly. Only the layout and content should differ.";
      return generateOne(
        prisma, record, project.id,
        { prompt: suitePrompt, systemPrompt: spec.prompt.systemPrompt, aspectRatio: spec.aspectRatio, imageSize: STANDARD_SIZE, referenceImage: heroBuffer },
        {
          textFree: spec.textFree,
          designType: spec.designType,
          textContent,
          languages,
        },
      );
    }),
  );

  // Collect completed designs
  const completed: Design[] = [];
  if (heroDesign.generationStatus === "COMPLETED") completed.push(heroDesign);

  for (const result of restResults) {
    if (result.status === "fulfilled") completed.push(result.value.design);

  }

  console.info(
    `[design] generateSuite:done projectId=${projectId} completed=${completed.length} total=${pieces.length}`,
  );

  return completed;
}

/**
 * Regenerate a single design.
 */
export async function regenerateDesign(
  prisma: PrismaClient,
  designId: string,
  newStyle?: string,
): Promise<Design> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { project: true },
  });
  if (!design) throw new NotFoundError("Design");

  const project = design.project;
  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = newStyle || design.style || (metadata?.style as string) || "modern";
  const textContent = (design.textContent as TextContent) || buildTextContent(project, metadata);
  const layoutGuide = LAYOUT_GUIDES[design.designType];

  const prompt = buildDesignPrompt(project.type, design.designType, style, textContent, languages, metadata);

  await prisma.design.update({
    where: { id: design.id },
    data: { generationStatus: "GENERATING", style, prompt: prompt.contentPrompt },
  });

  try {
    const imageBuffer = await generateDesignImage({
      prompt: prompt.contentPrompt,
      systemPrompt: prompt.systemPrompt,
      aspectRatio: layoutGuide?.aspectRatio || design.aspectRatio,
    });
    const finalBuffer = await applyTextLayers(imageBuffer, {
      textFree: prompt.textFree,
      designType: design.designType,
      textContent,
      languages,
    });

    const { previewUrl, fullUrl } = await processGeneratedImage(finalBuffer, design.id, project.id);

    return await prisma.design.update({
      where: { id: design.id },
      data: { previewUrl, fullUrl, generationStatus: "COMPLETED", prompt: prompt.contentPrompt, style },
    });
  } catch (err) {
    await prisma.design.update({ where: { id: design.id }, data: { generationStatus: "FAILED" } });
    throw new GeminiError("Failed to regenerate design", {
      originalError: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Edit text content of a design and regenerate.
 */
export async function editDesign(
  prisma: PrismaClient,
  designId: string,
  updatedText: TextContent,
): Promise<Design> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { project: true },
  });
  if (!design) throw new NotFoundError("Design");

  const project = design.project;
  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = design.style || (metadata?.style as string) || "modern";
  const layoutGuide = LAYOUT_GUIDES[design.designType];

  const prompt = buildDesignPrompt(project.type, design.designType, style, updatedText, languages, metadata);

  await prisma.design.update({
    where: { id: design.id },
    data: { generationStatus: "GENERATING", textContent: updatedText as object, prompt: prompt.contentPrompt },
  });

  try {
    const imageBuffer = await generateDesignImage({
      prompt: prompt.contentPrompt,
      systemPrompt: prompt.systemPrompt,
      aspectRatio: layoutGuide?.aspectRatio || design.aspectRatio,
    });
    const finalBuffer = await applyTextLayers(imageBuffer, {
      textFree: prompt.textFree,
      designType: design.designType,
      textContent: updatedText,
      languages,
    });

    const { previewUrl, fullUrl } = await processGeneratedImage(finalBuffer, design.id, project.id);

    return await prisma.design.update({
      where: { id: design.id },
      data: { previewUrl, fullUrl, generationStatus: "COMPLETED", textContent: updatedText as object, prompt: prompt.contentPrompt },
    });
  } catch (err) {
    await prisma.design.update({ where: { id: design.id }, data: { generationStatus: "FAILED" } });
    throw new GeminiError("Failed to edit design", {
      originalError: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Internal: generate a single design piece ───────────

interface GenerateOneResult {
  design: Design;
  /** Raw AI-generated background (before text compositing) — used as style reference for other suite pieces */
  rawBuffer: Buffer;
}

interface TextCompositeOpts {
  textFree: boolean;
  designType: string;
  textContent: TextContent;
  languages: string[];
}

function getHybridOverlay(designType: string, textContent: TextContent): TextCompositeOpts | null {
  if (designType !== "BABY_BIRTH_ANNOUNCEMENT") return null;

  const arabicName = textContent.babyName?.ar?.trim();
  if (!arabicName) return null;

  return {
    textFree: true,
    designType: "BABY_BIRTH_ANNOUNCEMENT_HERO_ARABIC_OVERLAY",
    textContent: {
      babyName: { ar: arabicName },
    },
    languages: ["ar"],
  };
}

async function applyTextLayers(
  background: Buffer,
  textOpts?: TextCompositeOpts,
): Promise<Buffer> {
  if (!textOpts) return background;

  let layered = background;

  if (textOpts.textFree) {
    layered = await compositeText({
      background: layered,
      designType: textOpts.designType,
      textContent: textOpts.textContent,
      languages: textOpts.languages,
    });
  }

  const hybridOverlay = getHybridOverlay(textOpts.designType, textOpts.textContent);
  if (hybridOverlay) {
    layered = await clearTextZones({
      background: layered,
      designType: hybridOverlay.designType,
      fields: ["babyName"],
    });
    layered = await compositeText({
      background: layered,
      designType: hybridOverlay.designType,
      textContent: hybridOverlay.textContent,
      languages: hybridOverlay.languages,
    });
  }

  return layered;
}

async function generateOne(
  prisma: PrismaClient,
  record: Design,
  projectId: string,
  opts: GenerateImageOpts,
  textOpts?: TextCompositeOpts,
): Promise<GenerateOneResult> {
  await prisma.design.update({ where: { id: record.id }, data: { generationStatus: "GENERATING" } });

  try {
    console.info(
      `[design] generateOne:start designId=${record.id} type=${record.designType} projectId=${projectId}`,
    );

    const rawBuffer = await withTimeout(
      generateDesignImage(opts),
      GEMINI_TIMEOUT_MS,
      `Gemini generation timed out for ${record.designType}`,
    );

    console.info(
      `[design] generateOne:gemini-complete designId=${record.id} type=${record.designType}`,
    );

    const finalBuffer = await applyTextLayers(rawBuffer, textOpts);

    console.info(
      `[design] generateOne:upload-start designId=${record.id} type=${record.designType}`,
    );

    const { previewUrl, fullUrl } = await withTimeout(
      processGeneratedImage(finalBuffer, record.id, projectId),
      STORAGE_TIMEOUT_MS,
      `Image upload timed out for ${record.designType}`,
    );

    const design = await prisma.design.update({
      where: { id: record.id },
      data: { previewUrl, fullUrl, generationStatus: "COMPLETED" },
    });

    console.info(
      `[design] generateOne:complete designId=${record.id} type=${record.designType}`,
    );

    return { design, rawBuffer };
  } catch (err) {
    await prisma.design.update({ where: { id: record.id }, data: { generationStatus: "FAILED" } });
    console.error(
      `[design] generateOne:failed designId=${record.id} type=${record.designType} error=${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
}

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

// ─── Helper: Build text content from project data ──────

function buildTextContent(
  project: Project,
  metadata: Record<string, unknown> | null,
): TextContent {
  const content: TextContent = {};

  if (project.type === "WEDDING") {
    addField(content, "groomName", metadata, "groomNameEn", "groomNameAr", "groomNameHi");
    addField(content, "brideName", metadata, "brideNameEn", "brideNameAr", "brideNameHi");
    addField(content, "groomFather", metadata, "groomFatherEn", "groomFatherAr", "groomFatherHi");
    addField(content, "brideFather", metadata, "brideFatherEn", "brideFatherAr", "brideFatherHi");
    addField(content, "groomFamily", metadata, "groomFamilyEn", "groomFamilyAr", "groomFamilyHi");
    addField(content, "brideFamily", metadata, "brideFamilyEn", "brideFamilyAr", "brideFamilyHi");
    addField(content, "familyName", metadata, "familyNameEn", "familyNameAr", "familyNameHi");
    addField(content, "venue", metadata, "venue", "venueAr", "venueHi");
    addField(content, "city", metadata, "city", "cityAr", "cityHi");
    addField(content, "additionalInfo", metadata, "additionalInfo", "additionalInfoAr", "additionalInfoHi");

    if (project.date) {
      content.date = { en: project.date.toISOString().split("T")[0], ar: project.dateHijri || "" };
    }
    if (metadata?.weddingTime) content.time = { en: metadata.weddingTime as string };
    if (metadata?.receptionTime) content.secondaryTime = { en: metadata.receptionTime as string };
  } else if (project.type === "BABY") {
    addField(content, "babyName", metadata, "babyNameEn", "babyNameAr", "babyNameHi",
      project.nameEn, project.nameAr, project.nameHi);
    addField(content, "parentNames", metadata, "parentNamesEn", "parentNamesAr", "parentNamesHi");
    addField(content, "additionalInfo", metadata, "additionalInfo", "additionalInfoAr", "additionalInfoHi");

    if (project.date) {
      content.birthDate = { en: project.date.toISOString().split("T")[0], ar: project.dateHijri || (metadata?.birthDateHijri as string) || "" };
    }
    if (metadata?.timeOfBirth) content.birthTime = { en: metadata.timeOfBirth as string };
    if (metadata?.weight) content.weight = { en: `${metadata.weight} kg` };
    if (metadata?.length) content.length = { en: `${metadata.length} cm` };
    if (metadata?.gender) content.gender = { en: metadata.gender as string };
  }

  return content;
}

function addField(
  content: TextContent,
  fieldName: string,
  metadata: Record<string, unknown> | null,
  enKey: string,
  arKey: string,
  hiKey: string,
  fallbackEn?: string | null,
  fallbackAr?: string | null,
  fallbackHi?: string | null,
): void {
  const en = (metadata?.[enKey] as string) || fallbackEn || "";
  const ar = (metadata?.[arKey] as string) || fallbackAr || "";
  const hi = (metadata?.[hiKey] as string) || fallbackHi || "";
  if (en || ar || hi) content[fieldName] = { en, ar, hi };
}

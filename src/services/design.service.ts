import type { PrismaClient, Project, Design, DesignType } from "@prisma/client";
import { generateDesignImage } from "../lib/ai/gemini.js";
import { buildDesignPrompt } from "../lib/ai/prompts.js";
import { LAYOUT_GUIDES } from "../lib/ai/layout-guides.js";
import { processGeneratedImage } from "./image.service.js";
import { NotFoundError, GeminiError } from "../errors/index.js";
import { resolveSuitePack } from "../lib/ai/suite-packs.js";

interface TextContent {
  [fieldName: string]: Record<string, string>;
}

/**
 * Generate the full design suite for a project.
 * Loads the project, determines which design types to generate,
 * builds prompts, generates via Gemini with concurrency control,
 * watermarks, uploads to R2, and saves Design records.
 */
export async function generateSuite(
  prisma: PrismaClient,
  projectId: string,
): Promise<Design[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  const pack = resolveSuitePack(project.type, project.metadata as Record<string, unknown> | null);
  const designTypes = pack.designTypes;
  if (!designTypes || designTypes.length === 0) {
    throw new GeminiError(`No design types configured for project type: ${project.type}`);
  }

  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = (metadata?.style as string) || "modern";
  const textContent = buildTextContent(project, metadata);

  // Create initial design records with PENDING status
  const designRecords = await Promise.all(
    designTypes.map((designType) => {
      const layoutGuide = LAYOUT_GUIDES[designType];
      const prompt = buildDesignPrompt(
        project.type,
        designType,
        style,
        textContent,
        languages,
        metadata,
      );

      return prisma.design.create({
        data: {
          projectId: project.id,
          designType: designType as DesignType,
          style,
          previewUrl: "", // Will be updated after generation
          prompt,
          aspectRatio: layoutGuide?.aspectRatio || "1:1",
          generationStatus: "PENDING",
          textContent: textContent as object,
        },
      });
    }),
  );

  // Generate images concurrently (limited by Gemini semaphore)
  const results = await Promise.allSettled(
    designRecords.map(async (design) => {
      try {
        // Update status to GENERATING
        await prisma.design.update({
          where: { id: design.id },
          data: { generationStatus: "GENERATING" },
        });

        const imageBuffer = await generateDesignImage(
          design.prompt || "",
          design.aspectRatio,
        );

        const { previewUrl, fullUrl } = await processGeneratedImage(
          imageBuffer,
          design.id,
          project.id,
        );

        // Update design with URLs and COMPLETED status
        return await prisma.design.update({
          where: { id: design.id },
          data: {
            previewUrl,
            fullUrl,
            generationStatus: "COMPLETED",
          },
        });
      } catch (err) {
        // Mark as FAILED
        await prisma.design.update({
          where: { id: design.id },
          data: { generationStatus: "FAILED" },
        });
        throw err;
      }
    }),
  );

  // Collect completed designs
  const completed: Design[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      completed.push(result.value);
    }
  }

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

  if (!design) {
    throw new NotFoundError("Design");
  }

  const project = design.project;
  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = newStyle || design.style || (metadata?.style as string) || "modern";
  const textContent = (design.textContent as TextContent) ||
    buildTextContent(project, metadata);

  const layoutGuide = LAYOUT_GUIDES[design.designType];
  const prompt = buildDesignPrompt(
    project.type,
    design.designType,
    style,
    textContent,
    languages,
    metadata,
  );

  // Update to GENERATING
  await prisma.design.update({
    where: { id: design.id },
    data: { generationStatus: "GENERATING", style, prompt },
  });

  try {
    const imageBuffer = await generateDesignImage(
      prompt,
      layoutGuide?.aspectRatio || design.aspectRatio,
    );

    const { previewUrl, fullUrl } = await processGeneratedImage(
      imageBuffer,
      design.id,
      project.id,
    );

    return await prisma.design.update({
      where: { id: design.id },
      data: {
        previewUrl,
        fullUrl,
        generationStatus: "COMPLETED",
        prompt,
        style,
      },
    });
  } catch (err) {
    await prisma.design.update({
      where: { id: design.id },
      data: { generationStatus: "FAILED" },
    });
    throw new GeminiError(
      "Failed to regenerate design",
      { originalError: err instanceof Error ? err.message : String(err) },
    );
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

  if (!design) {
    throw new NotFoundError("Design");
  }

  const project = design.project;
  const languages: string[] = JSON.parse(project.languages);
  const metadata = project.metadata as Record<string, unknown> | null;
  const style = design.style || (metadata?.style as string) || "modern";
  const layoutGuide = LAYOUT_GUIDES[design.designType];

  const prompt = buildDesignPrompt(
    project.type,
    design.designType,
    style,
    updatedText,
    languages,
    metadata,
  );

  await prisma.design.update({
    where: { id: design.id },
    data: {
      generationStatus: "GENERATING",
      textContent: updatedText as object,
      prompt,
    },
  });

  try {
    const imageBuffer = await generateDesignImage(
      prompt,
      layoutGuide?.aspectRatio || design.aspectRatio,
    );

    const { previewUrl, fullUrl } = await processGeneratedImage(
      imageBuffer,
      design.id,
      project.id,
    );

    return await prisma.design.update({
      where: { id: design.id },
      data: {
        previewUrl,
        fullUrl,
        generationStatus: "COMPLETED",
        textContent: updatedText as object,
        prompt,
      },
    });
  } catch (err) {
    await prisma.design.update({
      where: { id: design.id },
      data: { generationStatus: "FAILED" },
    });
    throw new GeminiError(
      "Failed to edit design",
      { originalError: err instanceof Error ? err.message : String(err) },
    );
  }
}

// ─── Helper: Build text content from project data ──────

function buildTextContent(
  project: Project,
  metadata: Record<string, unknown> | null,
): TextContent {
  const content: TextContent = {};

  if (project.type === "WEDDING") {
    // Names
    if (metadata?.groomNameEn || metadata?.groomNameAr || metadata?.groomNameHi) {
      content.groomName = {
        en: (metadata?.groomNameEn as string) || "",
        ar: (metadata?.groomNameAr as string) || "",
        hi: (metadata?.groomNameHi as string) || "",
      };
    }
    if (metadata?.brideNameEn || metadata?.brideNameAr || metadata?.brideNameHi) {
      content.brideName = {
        en: (metadata?.brideNameEn as string) || "",
        ar: (metadata?.brideNameAr as string) || "",
        hi: (metadata?.brideNameHi as string) || "",
      };
    }
    if (metadata?.groomFatherEn || metadata?.groomFatherAr || metadata?.groomFatherHi) {
      content.groomFather = {
        en: (metadata?.groomFatherEn as string) || "",
        ar: (metadata?.groomFatherAr as string) || "",
        hi: (metadata?.groomFatherHi as string) || "",
      };
    }
    if (metadata?.brideFatherEn || metadata?.brideFatherAr || metadata?.brideFatherHi) {
      content.brideFather = {
        en: (metadata?.brideFatherEn as string) || "",
        ar: (metadata?.brideFatherAr as string) || "",
        hi: (metadata?.brideFatherHi as string) || "",
      };
    }
    if (metadata?.groomFamilyEn || metadata?.groomFamilyAr || metadata?.groomFamilyHi) {
      content.groomFamily = {
        en: (metadata?.groomFamilyEn as string) || "",
        ar: (metadata?.groomFamilyAr as string) || "",
        hi: (metadata?.groomFamilyHi as string) || "",
      };
    }
    if (metadata?.brideFamilyEn || metadata?.brideFamilyAr || metadata?.brideFamilyHi) {
      content.brideFamily = {
        en: (metadata?.brideFamilyEn as string) || "",
        ar: (metadata?.brideFamilyAr as string) || "",
        hi: (metadata?.brideFamilyHi as string) || "",
      };
    }
    if (metadata?.familyNameEn || metadata?.familyNameAr || metadata?.familyNameHi) {
      content.familyName = {
        en: (metadata?.familyNameEn as string) || "",
        ar: (metadata?.familyNameAr as string) || "",
        hi: (metadata?.familyNameHi as string) || "",
      };
    }
    if (metadata?.venue) {
      content.venue = {
        en: (metadata?.venue as string) || "",
        ar: (metadata?.venueAr as string) || "",
        hi: (metadata?.venueHi as string) || "",
      };
    }
    if (project.date) {
      content.date = {
        en: project.date.toISOString().split("T")[0],
        ar: project.dateHijri || "",
      };
    }
    if (metadata?.weddingTime) {
      content.time = {
        en: (metadata.weddingTime as string) || "",
      };
    }
    if (metadata?.receptionTime) {
      content.secondaryTime = {
        en: (metadata.receptionTime as string) || "",
      };
    }
    if (metadata?.city) {
      content.city = {
        en: (metadata.city as string) || "",
        ar: (metadata.cityAr as string) || "",
        hi: (metadata.cityHi as string) || "",
      };
    }
    if (metadata?.additionalInfo || metadata?.additionalInfoAr || metadata?.additionalInfoHi) {
      content.additionalInfo = {
        en: (metadata.additionalInfo as string) || "",
        ar: (metadata.additionalInfoAr as string) || "",
        hi: (metadata.additionalInfoHi as string) || "",
      };
    }
  } else if (project.type === "BABY") {
    if (metadata?.babyNameEn || metadata?.babyNameAr || metadata?.babyNameHi) {
      content.babyName = {
        en: (metadata?.babyNameEn as string) || project.nameEn || "",
        ar: (metadata?.babyNameAr as string) || project.nameAr || "",
        hi: (metadata?.babyNameHi as string) || project.nameHi || "",
      };
    }
    if (metadata?.parentNamesEn || metadata?.parentNamesAr || metadata?.parentNamesHi) {
      content.parentNames = {
        en: (metadata?.parentNamesEn as string) || "",
        ar: (metadata?.parentNamesAr as string) || "",
        hi: (metadata?.parentNamesHi as string) || "",
      };
    }
    if (project.date) {
      content.birthDate = {
        en: project.date.toISOString().split("T")[0],
        ar: project.dateHijri || (metadata?.birthDateHijri as string) || "",
      };
    }
    if (metadata?.timeOfBirth) {
      content.birthTime = { en: metadata.timeOfBirth as string };
    }
    if (metadata?.weight) {
      content.weight = { en: `${metadata.weight} kg` };
    }
    if (metadata?.length) {
      content.length = { en: `${metadata.length} cm` };
    }
    if (metadata?.gender) {
      content.gender = { en: metadata.gender as string };
    }
    if (metadata?.additionalInfo || metadata?.additionalInfoAr || metadata?.additionalInfoHi) {
      content.additionalInfo = {
        en: (metadata.additionalInfo as string) || "",
        ar: (metadata.additionalInfoAr as string) || "",
        hi: (metadata.additionalInfoHi as string) || "",
      };
    }
  }

  return content;
}

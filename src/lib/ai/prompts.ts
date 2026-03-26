import { STYLE_GUIDES } from "./style-guides.js";
import type { CategoryPromptConfig } from "../categories/seed-data.js";
import {
  getCategoryPrompts,
  getSubcategoryPrompt,
  selectVariant,
} from "./prompt-selector.js";

export interface GenerationPrompt {
  systemPrompt: string;
  contentPrompt: string;
  variantId?: string;
}

export interface PromptOptions {
  categoryId?: string;
  subcategoryId?: string;
  promptVariant?: string;
  outputFormatId?: string;
  outputFormatLabel?: string;
  outputFormatDescription?: string;
  outputFormatPromptHint?: string;
  outputResolution?: string;
}

const DIRECT_DELIVERABLE_CATEGORIES = new Set([
  "event-stationery",
  "wall-art",
  "greeting-cards",
  "social-media",
  "business",
  "religious-art",
  "education",
]);

const DIRECT_DELIVERABLE_SUBCATEGORIES = new Set([
  "menu-design",
  "recipe-card",
  "collection-announcement",
  "destination-art",
  "hotel-welcome",
  "itinerary-design",
  "travel-poster",
]);

const FOOD_DESIGN_SUBCATEGORIES = new Set(["menu-design", "recipe-card"]);
const FASHION_FLATLAY_SUBCATEGORIES = new Set(["outfit-card", "style-board"]);
const REAL_ESTATE_SUBCATEGORIES = new Set([
  "property-listing",
  "room-staging",
  "interior-concept",
  "development-marketing",
]);
const PORTRAIT_SUBCATEGORIES = new Set([
  "stylized-portrait",
  "professional-avatar",
  "family-portrait",
  "pet-portrait",
]);
const TRAVEL_SCENE_FORMATS = new Set(["destination-hero", "social-postcard"]);
const FASHION_EDITORIAL_FORMATS = new Set([
  "editorial-portrait",
  "lookbook-page",
  "campaign-story",
]);
const BORDERLESS_SUBCATEGORIES = new Set([
  "thank-you-greeting",
  "congratulations-card",
  "condolence-card",
  "eid-card",
  "ramadan-card",
  "diwali-card",
  "christmas-card",
  "national-day-card",
  "certificate",
]);

/**
 * Build the Gemini prompt for any category generation.
 *
 * When a categoryId is provided and found in the prompt database,
 * uses enhanced Gemini-optimized prompts with variant selection.
 * Falls back to the original categoryConfig if not found.
 */
export function buildGenerationPrompt(
  categoryConfig: CategoryPromptConfig,
  subcategoryPrompt: string | null,
  userPrompt: string | null,
  style: string,
  metadata: Record<string, unknown> | null,
  aspectRatio: string,
  options?: PromptOptions,
): GenerationPrompt {
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES.modern;
  const effectiveUserPrompt = resolveEffectiveUserPrompt(
    userPrompt,
    metadata,
    options,
  );
  const metadataLineExclusions = new Set(["userPrompt"]);
  if (
    !userPrompt?.trim()
    && effectiveUserPrompt
    && effectiveUserPrompt === readMetadataText(metadata, "additionalInfo")
  ) {
    metadataLineExclusions.add("additionalInfo");
  }

  // Try to use enhanced prompts from the prompt database
  let activeSystemPrompt = categoryConfig.systemPrompt;
  let activeContextTemplate = categoryConfig.contextTemplate;
  let activeOutputGuidance = categoryConfig.outputGuidance;
  let activeNegativeGuidance = categoryConfig.negativeGuidance;
  let activeSubcategoryPrompt = subcategoryPrompt;
  let variantId: string | undefined;

  if (options?.categoryId) {
    const categoryPrompts = getCategoryPrompts(options.categoryId);
    if (categoryPrompts) {
      // Select a variant (weighted random or explicit)
      const variant = selectVariant(
        categoryPrompts.variants,
        options.promptVariant,
      );
      variantId = variant.id;

      activeSystemPrompt = variant.systemPrompt;
      activeContextTemplate = variant.contextTemplate;
      activeOutputGuidance = variant.outputGuidance;
      activeNegativeGuidance = variant.negativeGuidance;

      // Use enhanced subcategory prompt if available
      if (options.subcategoryId) {
        const enhancedSubPrompt = getSubcategoryPrompt(
          categoryPrompts,
          options.subcategoryId,
        );
        if (enhancedSubPrompt) {
          activeSubcategoryPrompt = enhancedSubPrompt;
        }
      }
    }
  }

  // Build content prompt from pieces
  const parts: string[] = [];

  if (effectiveUserPrompt) {
    // ── User-driven mode ──────────────────────────────────────
    // Strip everything down to: raw metadata values + user's words.
    // No "Create a X design", no "Design type: X" — these labels
    // trigger Gemini's prior to fill in a complete template.
    if (metadata) {
      const metadataLines = Object.entries(metadata)
        .filter(([key]) => !metadataLineExclusions.has(key))
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("\n");
      if (metadataLines) parts.push(metadataLines);
    }
    parts.push(`DESIGNER'S CREATIVE DIRECTION: ${effectiveUserPrompt}`);
    parts.push(
      "Do NOT add any text, names, titles, descriptions, dates, or signature lines that the designer did not explicitly request. If the designer asked for empty or blank areas, leave them empty.",
    );
  } else {
    // ── Template-driven mode (no user prompt) ─────────────────
    // Full templates serve as the design direction.
    if (metadata) {
      parts.push(fillTemplate(activeContextTemplate, metadata));
    }
    if (activeSubcategoryPrompt) {
      const filledSubPrompt = metadata
        ? fillTemplate(activeSubcategoryPrompt, metadata)
        : activeSubcategoryPrompt;
      parts.push(filledSubPrompt);
    }
  }

  // 4. Style / output mode intent
  const directDeliverable =
    (options?.categoryId && DIRECT_DELIVERABLE_CATEGORIES.has(options.categoryId))
    || (options?.subcategoryId && DIRECT_DELIVERABLE_SUBCATEGORIES.has(options.subcategoryId));
  const foodPhotographyOutput =
    options?.categoryId === "food-restaurant"
    && (!options.subcategoryId || !FOOD_DESIGN_SUBCATEGORIES.has(options.subcategoryId));
  const realEstateOutput =
    options?.categoryId === "real-estate"
    && (!options.subcategoryId || REAL_ESTATE_SUBCATEGORIES.has(options.subcategoryId));
  const fashionEditorialOutput =
    options?.categoryId === "fashion"
    && !directDeliverable
    && !FASHION_FLATLAY_SUBCATEGORIES.has(options?.subcategoryId ?? "")
    && (
      options?.subcategoryId === "lookbook"
      || !options?.subcategoryId
      || FASHION_EDITORIAL_FORMATS.has(options?.outputFormatId ?? "")
    );
  const fashionFlatlayOutput =
    options?.categoryId === "fashion"
    && FASHION_FLATLAY_SUBCATEGORIES.has(options?.subcategoryId ?? "");
  const portraitOutput =
    options?.categoryId === "portraits"
    && (!options.subcategoryId || PORTRAIT_SUBCATEGORIES.has(options.subcategoryId));
  const travelSceneOutput =
    options?.categoryId === "travel"
    && !directDeliverable
    && (
      !options?.subcategoryId
      || TRAVEL_SCENE_FORMATS.has(options?.outputFormatId ?? "")
    );
  const restrainedPhotographyOutput =
    foodPhotographyOutput
    || realEstateOutput
    || fashionEditorialOutput
    || portraitOutput
    || travelSceneOutput;
  const borderlessSubcategory =
    options?.subcategoryId && BORDERLESS_SUBCATEGORIES.has(options.subcategoryId);
  const styleSystemPrompt = restrainedPhotographyOutput
    ? `Translate the selected style '${style}' into subtle color mood, finish, and compositional restraint only. Do not introduce decorative borders, frames, overlays, motifs, typography, scrapbook elements, or themed graphic treatments unless the user explicitly asks for them. The subject of the image must remain the clear hero.`
    : borderlessSubcategory
      ? `${styleGuide.systemPrompt}\n\nIMPORTANT: Do not add decorative borders, frames, or background padding around the design. The artwork must fill the entire canvas edge-to-edge. Translate border or frame references in the style into integrated design elements, patterns, or textures that extend to the edges rather than framing the content.`
      : styleGuide.systemPrompt;

  // System prompt = category persona + style persona + user priority rule
  const userPriorityRule = effectiveUserPrompt
    ? "\n\nThe user has provided their own creative direction. Follow it exactly. Only include elements the user explicitly asks for. Do not invent placeholder names, sample text, or filler content that the user did not request."
    : "";
  const systemPrompt = `${activeSystemPrompt}\n\n${styleSystemPrompt}${userPriorityRule}`;

  parts.push(`Visual style: ${styleGuide.description}`);
  parts.push(`Color palette: ${styleGuide.colors}`);

  // 5. Aspect ratio
  parts.push(`Output aspect ratio: ${aspectRatio}`);
  if (aspectRatio === "A4" || aspectRatio === "A5") {
    parts.push(
      effectiveUserPrompt
        ? `Compose with the proportions of an ${aspectRatio} print layout in portrait orientation.`
        : `Compose with the visual rhythm and page structure of an ${aspectRatio} print layout. Keep margins, spacing, hierarchy, and safe text zones appropriate for a printable portrait page even if the renderer uses the nearest supported portrait ratio internally.`,
    );
  }

  // 6. Render intent for direct-use design assets

  if (directDeliverable) {
    parts.push(
      effectiveUserPrompt
        ? "Render the final design asset in a straight-on, front-facing, full-frame composition. Do not present it as a photographed mockup, desk scene, or lifestyle environment."
        : "Render the final design asset itself in a straight-on, front-facing, full-frame composition. Do not present it as a photographed mockup, desk scene, tabletop shot, wall frame, hand-held card, or lifestyle environment unless the user explicitly asks for a mockup. Show the full deliverable surface with clean edges, production-ready layout, and legible content.",
    );
  }

  if (foodPhotographyOutput) {
    parts.push(
      "Render a full-bleed food photograph, not a designed poster, card, collage, or framed layout. No decorative borders, celestial motifs, florals, gold-foil treatments, inset windows, paper textures, graphic overlays, or visible text unless the user explicitly asks for them. The plated dish should dominate the frame and read immediately as freshly served, edible, and craveable.",
    );
    parts.push(
      "Push appetite and taste cues through glossy sauces, crisp edges, moist interiors, fresh garnish, believable texture, and lighting that suggests aroma, warmth, and just-cooked freshness. Avoid obvious white steam, smoke, mist, or vapor effects unless the user explicitly asks for them.",
    );
  }

  if (realEstateOutput) {
    parts.push(
      "Render a full-bleed architectural image or interior visualization, not a framed poster, flyer, or decorated layout. No decorative borders, florals, gold-foil accents, celestial motifs, graphic overlays, or visible text unless the user explicitly asks for them. The space itself should dominate the frame and sell immediately at first glance.",
    );
    parts.push(
      "Keep architectural lines physically plausible and visually disciplined: straight verticals, believable lens perspective, grounded furniture, coherent lighting, and material realism that communicates warmth, livability, and premium quality.",
    );
  }

  if (fashionEditorialOutput) {
    parts.push(
      "Render a full-bleed fashion image with the garment, styling, and subject as the hero. Do not turn it into a decorated card, bordered poster, scrapbook collage, or motif-heavy graphic. No decorative frames, florals, foil treatments, celestial symbols, or visible text unless the user explicitly asks for them.",
    );
    parts.push(
      "Push editorial fashion cues: strong silhouette readability, believable fabric behavior, intentional pose, premium lighting, and texture detail that makes the clothing feel tactile and desirable.",
    );
  }

  if (fashionFlatlayOutput) {
    parts.push(
      "Render the flat-lay or style board directly as the final composition from a clean overhead or design-board perspective. Do not place it inside a mockup, room scene, ornate frame, scrapbook border, or device screen unless the user explicitly asks for that treatment.",
    );
    parts.push(
      "Keep the arrangement crisp and editorial: clean spacing, balanced placement, fabric and material clarity, and strong visual hierarchy without extraneous decorative motifs competing with the pieces.",
    );
  }

  if (portraitOutput) {
    parts.push(
      "Render the subject as the clear hero of the portrait. No decorative borders, celestial symbols, foil frames, floating ornaments, typographic overlays, or graphic motifs unless the user explicitly asks for them. Keep the composition portrait-led rather than template-led.",
    );
    parts.push(
      "Prioritize likeness, expression, flattering light, believable skin or medium texture, and clear eye focus so the portrait feels personal, authored, and emotionally specific.",
    );
  }

  if (travelSceneOutput) {
    parts.push(
      "Render a full-bleed destination scene, not a bordered postcard, framed collage, or decorated travel card. No ornate borders, floral overlays, foil embellishments, or visible text unless the user explicitly asks for them. The place itself should be the hero.",
    );
    parts.push(
      "Emphasize sense of place through light, atmosphere, scale, and culturally specific detail so the viewer immediately feels the destination rather than a generic travel template.",
    );
  }

  if (options?.subcategoryId && BORDERLESS_SUBCATEGORIES.has(options.subcategoryId)) {
    parts.push(
      "IMPORTANT: The design must fill the entire canvas edge-to-edge. Do not add decorative borders, frames, margin strips, or background padding around the artwork. The imagery, patterns, and colors should extend to all four edges with no visible border or background gap. Treat the full output area as the live design surface.",
    );
  }

  if (options?.subcategoryId === "certificate") {
    parts.push(
      "Certificate text is opt-in only. Do not add any title, recipient name, achievement description, date, signature line, seal label, or other copy unless it is explicitly provided in the prompt or metadata.",
    );
    if (shouldRenderInstitutionOnly(metadata)) {
      parts.push(
        "The institution name is the only supplied text content. Render only the institution name in the requested header position and keep the remainder of the design free of visible text.",
      );
    }
  }

  // 7. Output format intent — skip text-heavy hints when user drives the design
  if (!effectiveUserPrompt && options?.outputFormatLabel) {
    const formatSummary = options.outputFormatDescription
      ? `${options.outputFormatLabel} — ${options.outputFormatDescription}`
      : options.outputFormatLabel;
    parts.push(`Intended output format: ${formatSummary}`);
  }

  if (options?.outputResolution) {
    parts.push(`Target resolution: ${options.outputResolution}`);
  }

  if (!effectiveUserPrompt && options?.outputFormatPromptHint) {
    parts.push(`Format guidance: ${options.outputFormatPromptHint}`);
  }

  // 8. Output guidance — skip when user provides their own direction
  if (!effectiveUserPrompt && activeOutputGuidance) {
    const filledGuidance = metadata
      ? fillTemplate(activeOutputGuidance, metadata)
      : activeOutputGuidance;
    parts.push(filledGuidance);
  }

  // 9. Quality guidance — skip when user provides their own direction
  if (!effectiveUserPrompt && activeNegativeGuidance) {
    parts.push(`Quality guidance: ${activeNegativeGuidance}`);
  }

  // 10. Reinforce user's creative direction as the final word
  if (effectiveUserPrompt) {
    parts.push(
      `CRITICAL: The designer's creative direction is the sole content authority. Do NOT invent or add any text the designer did not ask for — no fake names, no placeholder titles like "Certificate of Achievement", no achievement descriptions, no dates, no signature lines, no labels. If the designer said "empty" or "only", render exactly and only what they specified. Blank space is intentional.`,
    );
  }

  const contentPrompt = parts.filter(Boolean).join("\n\n");

  return { systemPrompt, contentPrompt, variantId };
}

/**
 * Simple template filler: replaces {{key}} with metadata values.
 * Handles conditional blocks: {{#key}}...{{/key}} only renders if key is truthy.
 */
function fillTemplate(
  template: string,
  metadata: Record<string, unknown>,
): string {
  let result = template;

  // Handle conditional blocks: {{#key}}content{{/key}}
  result = result.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key, content) => {
      const value = metadata[key];
      if (value === undefined || value === null || value === "") return "";
      // Also fill the inner content with the same metadata
      return fillTemplate(content, metadata);
    },
  );

  // Handle simple replacements: {{key}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = metadata[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });

  return result.trim();
}

function resolveEffectiveUserPrompt(
  userPrompt: string | null,
  metadata: Record<string, unknown> | null,
  options?: PromptOptions,
): string | null {
  const trimmedUserPrompt = userPrompt?.trim();
  if (trimmedUserPrompt) return trimmedUserPrompt;

  const additionalInfo = readMetadataText(metadata, "additionalInfo");
  if (!additionalInfo) return null;

  return isRestrictiveTextInstruction(additionalInfo, options)
    ? additionalInfo
    : null;
}

function readMetadataText(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = metadata?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRestrictiveTextInstruction(
  instruction: string,
  options?: PromptOptions,
): boolean {
  if (
    /do\s*not\s+add|don't\s+add|dont\s+add|no\s+extra\s+text|no\s+other\s+text|leave.*blank|keep.*blank|text-free|without\s+text/i.test(
      instruction,
    )
  ) {
    return true;
  }

  if (
    options?.subcategoryId === "certificate"
    && /(only|just).*(school|institution|name|header|logo|text)/i.test(instruction)
  ) {
    return true;
  }

  return false;
}

function shouldRenderInstitutionOnly(
  metadata: Record<string, unknown> | null,
): boolean {
  return Boolean(
    readMetadataText(metadata, "institution")
      && !readMetadataText(metadata, "recipientName")
      && !readMetadataText(metadata, "subject"),
  );
}

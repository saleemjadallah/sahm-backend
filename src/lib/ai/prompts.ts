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
  outputFormatLabel?: string;
  outputFormatDescription?: string;
  outputFormatPromptHint?: string;
  outputResolution?: string;
}

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

  // System prompt = category persona + style persona
  const systemPrompt = `${activeSystemPrompt}\n\n${styleGuide.systemPrompt}`;

  // Build content prompt from pieces
  const parts: string[] = [];

  // 1. Category context template filled with metadata
  if (metadata) {
    parts.push(fillTemplate(activeContextTemplate, metadata));
  }

  // 2. Subcategory-specific prompt fragment (also fill with metadata)
  if (activeSubcategoryPrompt) {
    const filledSubPrompt = metadata
      ? fillTemplate(activeSubcategoryPrompt, metadata)
      : activeSubcategoryPrompt;
    parts.push(filledSubPrompt);
  }

  // 3. User's free-text prompt
  if (userPrompt) {
    parts.push(`User request: ${userPrompt}`);
  }

  // 4. Style description
  parts.push(`Visual style: ${styleGuide.description}`);
  parts.push(`Color palette: ${styleGuide.colors}`);

  // 5. Aspect ratio
  parts.push(`Output aspect ratio: ${aspectRatio}`);

  // 6. Output format intent
  if (options?.outputFormatLabel) {
    const formatSummary = options.outputFormatDescription
      ? `${options.outputFormatLabel} — ${options.outputFormatDescription}`
      : options.outputFormatLabel;
    parts.push(`Intended output format: ${formatSummary}`);
  }

  if (options?.outputResolution) {
    parts.push(`Target resolution: ${options.outputResolution}`);
  }

  if (options?.outputFormatPromptHint) {
    parts.push(`Format guidance: ${options.outputFormatPromptHint}`);
  }

  // 7. Output guidance
  if (activeOutputGuidance) {
    const filledGuidance = metadata
      ? fillTemplate(activeOutputGuidance, metadata)
      : activeOutputGuidance;
    parts.push(filledGuidance);
  }

  // 8. Quality guidance (positive framing)
  if (activeNegativeGuidance) {
    parts.push(`Quality guidance: ${activeNegativeGuidance}`);
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

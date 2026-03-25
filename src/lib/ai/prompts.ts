import { STYLE_GUIDES } from "./style-guides.js";
import type { CategoryPromptConfig } from "../categories/seed-data.js";

export interface GenerationPrompt {
  systemPrompt: string;
  contentPrompt: string;
}

/**
 * Build the Gemini prompt for any category generation.
 * Replaces the old ceremony-specific prompt builder.
 */
export function buildGenerationPrompt(
  categoryConfig: CategoryPromptConfig,
  subcategoryPrompt: string | null,
  userPrompt: string | null,
  style: string,
  metadata: Record<string, unknown> | null,
  aspectRatio: string,
): GenerationPrompt {
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES.modern;

  // System prompt = category persona + style persona
  const systemPrompt = `${categoryConfig.systemPrompt}\n\n${styleGuide.systemPrompt}`;

  // Build content prompt from pieces
  const parts: string[] = [];

  // 1. Category context template filled with metadata
  if (metadata) {
    parts.push(fillTemplate(categoryConfig.contextTemplate, metadata));
  }

  // 2. Subcategory-specific prompt fragment
  if (subcategoryPrompt) {
    parts.push(subcategoryPrompt);
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

  // 6. Output guidance
  parts.push(categoryConfig.outputGuidance);

  // 7. Negative guidance
  if (categoryConfig.negativeGuidance) {
    parts.push(`IMPORTANT — do NOT: ${categoryConfig.negativeGuidance}`);
  }

  const contentPrompt = parts.filter(Boolean).join("\n\n");

  return { systemPrompt, contentPrompt };
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

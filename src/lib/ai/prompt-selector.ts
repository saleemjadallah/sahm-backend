/**
 * Prompt variant selector — picks a prompt variant for generation.
 *
 * Supports weighted random selection (default) or explicit variant ID.
 * Used by buildGenerationPrompt() to select from the prompt database.
 */

import {
  PROMPT_DATABASE,
  type PromptVariant,
  type CategoryPromptEntry,
} from "./prompt-database.js";

/** Look up a category's prompt entry from the database. */
export function getCategoryPrompts(
  categoryId: string,
): CategoryPromptEntry | undefined {
  return PROMPT_DATABASE.find((c) => c.categoryId === categoryId);
}

/** Get a subcategory's enhanced prompt template from a category entry. */
export function getSubcategoryPrompt(
  entry: CategoryPromptEntry,
  subcategoryId: string,
): string | undefined {
  return entry.subcategories.find((s) => s.subcategoryId === subcategoryId)
    ?.promptTemplate;
}

/**
 * Select a prompt variant — by explicit ID or weighted random.
 *
 * @param variants - Array of prompt variants (weights should sum to 1.0)
 * @param requestedId - Optional explicit variant ID to select
 * @returns The selected prompt variant
 */
export function selectVariant(
  variants: PromptVariant[],
  requestedId?: string,
): PromptVariant {
  // Explicit selection
  if (requestedId) {
    const found = variants.find((v) => v.id === requestedId);
    if (found) return found;
  }

  // Weighted random selection
  const rand = Math.random();
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (rand <= cumulative) return variant;
  }

  // Fallback to first variant (main)
  return variants[0];
}

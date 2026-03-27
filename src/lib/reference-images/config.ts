export interface ReferenceImageConfig {
  mode: "identity" | "subject" | "scene";
  label: string;
  hint: string;
}

export const REFERENCE_IMAGE_CONFIG: Record<string, ReferenceImageConfig> = {
  portraits: {
    mode: "identity",
    label: "Reference photo",
    hint: "Use one clear photo to preserve the person, pet, or family more faithfully in the final artwork.",
  },
  fashion: {
    mode: "subject",
    label: "Reference look",
    hint: "Use one outfit, garment, or model image to preserve the key look while changing the styling or setting.",
  },
  "food-photography": {
    mode: "subject",
    label: "Reference dish",
    hint: "Use one food photo to keep the hero dish recognizable while improving plating, lighting, or styling.",
  },
  "real-estate": {
    mode: "scene",
    label: "Reference space",
    hint: "Use one room or property photo to preserve the layout and architectural features while upgrading the presentation.",
  },
};

export function getReferenceImageConfig(
  categoryId: string,
): ReferenceImageConfig | null {
  return REFERENCE_IMAGE_CONFIG[categoryId] ?? null;
}

export function buildReferencePromptInstruction(categoryId: string): string | null {
  const config = getReferenceImageConfig(categoryId);
  if (!config) return null;

  switch (config.mode) {
    case "identity":
      return [
        "REFERENCE IMAGE: Treat the attached image as the subject identity reference.",
        "Preserve the person's or pet's core identity, facial structure, hair or fur characteristics, skin tone or coloring, age cues, and other defining traits.",
        "You may change the artistic medium, background, wardrobe styling, and composition only when the request asks for it, but the subject should still feel recognizably the same.",
      ].join(" ");
    case "scene":
      return [
        "REFERENCE IMAGE: Treat the attached image as the source scene reference.",
        "Preserve the overall room or property layout, architecture, fixed features, and major furnishings while improving styling, lighting, cleanliness, and presentation to match the request.",
      ].join(" ");
    case "subject":
      return [
        "REFERENCE IMAGE: Treat the attached image as the primary subject reference.",
        "Preserve the main subject's defining visual traits, colors, materials, and silhouette while adapting the composition, lighting, and art direction to the request.",
      ].join(" ");
  }
}

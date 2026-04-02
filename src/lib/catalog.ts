import { PackageType, PortraitStyle } from "@prisma/client";

export type StyleDefinition = {
  label: string;
  shortDescription: string;
  guidance: string;
  emotionalTone: string;
  composition: string;
  background: string;
  lighting: string;
  textTreatment: string;
  negativeGuidance: string;
  palette: [string, string, string];
};

export const STYLE_DEFINITIONS: Record<PortraitStyle, StyleDefinition> = {
  WATERCOLOR: {
    label: "Watercolor",
    shortDescription: "Soft brush texture with a dreamy paper finish.",
    guidance:
      "Soft, flowing watercolor painting with gentle color bleeds, visible brush texture, white paper highlights, and a warm abstract background.",
    emotionalTone: "gentle, comforting, and quietly celebratory",
    composition: "single centered pet portrait with breathing room around the silhouette",
    background: "soft abstract washes that do not compete with the pet",
    lighting: "soft natural daylight with delicate highlights on fur and eyes",
    textTreatment: "if memorial text is used, place it subtly near the lower margin like fine stationery",
    negativeGuidance:
      "avoid hard outlines, photorealistic rendering, busy scenery, extra animals, text clutter, and muddy colors",
    palette: ["#f6efe7", "#d4a0a0", "#7c9885"],
  },
  OIL_PAINTING: {
    label: "Oil Painting",
    shortDescription: "Classical portraiture with rich brushwork and warm light.",
    guidance:
      "Rich classical oil painting with visible brushstrokes, deep shadows, warm golden lighting, and a dark muted old-masters background.",
    emotionalTone: "dignified, noble, and timeless",
    composition: "formal chest-up or three-quarter portrait with poised posture",
    background: "deep painterly background in warm neutrals and muted browns",
    lighting: "directional golden museum-style light with dimensional shadow",
    textTreatment: "if memorial text is used, treat it like a discreet signature plate",
    negativeGuidance:
      "avoid modern props, cartoon styling, flat lighting, noisy detail, duplicate limbs, and theatrical over-saturation",
    palette: ["#4f3c2f", "#c5a572", "#8a6f57"],
  },
  RENAISSANCE: {
    label: "Renaissance",
    shortDescription: "Regal and slightly playful old-world grandeur.",
    guidance:
      "A majestic court portrait with regal accessories, draped fabric, columns or castle details, and deep red, blue, and gold tones.",
    emotionalTone: "majestic, affectionate, and lightly humorous without becoming silly",
    composition: "heroic portrait with elegant posture and royal framing details",
    background: "courtly architecture, drapery, or castle-inspired backdrop",
    lighting: "warm painterly light with regal contrast",
    textTreatment: "if memorial text is used, integrate it like a classic engraved cartouche",
    negativeGuidance:
      "avoid parody costumes, meme humor, cheap novelty energy, modern objects, and distorted anatomy",
    palette: ["#6e2230", "#1f3763", "#c5a572"],
  },
  RAINBOW_BRIDGE: {
    label: "Rainbow Bridge",
    shortDescription: "Ethereal, comforting, and full of peace.",
    guidance:
      "A comforting memorial portrait near a luminous rainbow bridge with soft golden light, clouds, meadow greens, and a peaceful heavenly atmosphere.",
    emotionalTone: "peaceful, healing, and emotionally reassuring",
    composition: "pet standing or walking calmly with graceful horizon depth",
    background: "ethereal bridge, soft meadow, clouds, and a restrained rainbow arc",
    lighting: "radiant golden-hour light with airy glow and no harsh contrast",
    textTreatment: "if memorial text is used, blend it softly into the sky or lower foreground",
    negativeGuidance:
      "avoid melodrama, overwhelming rainbow effects, human angels, excessive fantasy clutter, and dark grief-heavy imagery",
    palette: ["#83c5be", "#ffddd2", "#f6bd60"],
  },
  PENCIL_SKETCH: {
    label: "Pencil Sketch",
    shortDescription: "Hyper-detailed graphite portrait with soulful eyes.",
    guidance:
      "A detailed pencil or charcoal sketch on cream paper with realistic fur texture, emphasis on expressive eyes, and minimal background.",
    emotionalTone: "quiet, intimate, and timeless",
    composition: "close portrait with strong eye contact and elegant paper margins",
    background: "minimal cream paper with little to no scenery",
    lighting: "soft studio light translated into graphite depth and texture",
    textTreatment: "if memorial text is used, keep it understated like an artist inscription",
    negativeGuidance:
      "avoid full-color rendering, noisy sketch marks, busy scenes, decorative clutter, and exaggerated cartoon eyes",
    palette: ["#f0ece4", "#80766a", "#3d3d3d"],
  },
  POP_ART: {
    label: "Pop Art",
    shortDescription: "Bold, bright, celebratory color-block energy.",
    guidance:
      "A vibrant Warhol-inspired pop art portrait with bold outlines, contrasting colors, halftone texture, and a playful celebratory mood.",
    emotionalTone: "joyful, affectionate, and personality-forward",
    composition: "graphic portrait that feels poster-ready and balanced",
    background: "bold color fields or panel treatment with strong contrast",
    lighting: "flattened graphic lighting rather than realistic shading",
    textTreatment: "if memorial text is used, keep it poster-clean and minimal",
    negativeGuidance:
      "avoid muddy palettes, cluttered collage elements, realism, low contrast, and cheap clip-art aesthetics",
    palette: ["#ff5d73", "#ffd166", "#118ab2"],
  },
  STAINED_GLASS: {
    label: "Stained Glass",
    shortDescription: "Luminous jewel tones with reverent structure.",
    guidance:
      "A stained-glass window composition with bold lead outlines, jewel-toned translucent panels, decorative borders, and luminous backlit color.",
    emotionalTone: "reverent, luminous, and elevated",
    composition: "front-facing memorial panel with elegant symmetry",
    background: "decorative stained-glass framing and jewel-toned segments",
    lighting: "backlit radiance as if sunlight is shining through glass",
    textTreatment: "if memorial text is used, integrate it into a lower border panel",
    negativeGuidance:
      "avoid soft painterly blur, weak outlines, random geometry, muddy glass colors, and cartoon simplification",
    palette: ["#2d6a4f", "#7b2cbf", "#f4a261"],
  },
  IMPRESSIONIST: {
    label: "Impressionist",
    shortDescription: "Sunlit, nostalgic, and painterly.",
    guidance:
      "A Monet-inspired impressionist portrait with loose brushstrokes, dappled light, a meadow or garden setting, and warm nostalgic color.",
    emotionalTone: "warm, nostalgic, and life-affirming",
    composition: "pet in a lively natural setting with painterly movement",
    background: "garden or meadow with soft floral and landscape suggestion",
    lighting: "dappled sunlight with lively brushstroke transitions",
    textTreatment: "if memorial text is used, keep it delicate and secondary to the painting",
    negativeGuidance:
      "avoid hard realism, sharp digital edges, over-defined backgrounds, gloomy palettes, and visual clutter",
    palette: ["#a8dadc", "#f1faee", "#e9c46a"],
  },
  ANIME: {
    label: "Anime",
    shortDescription: "Gentle illustration with a magical softness.",
    guidance:
      "A soft anime illustration with expressive eyes, whimsical scenery, airy lighting, and a cozy magical-world atmosphere.",
    emotionalTone: "tender, whimsical, and bright-hearted",
    composition: "clean character-style portrait with readable silhouette and charm",
    background: "gentle storybook world such as blossoms, lantern light, or a cozy interior",
    lighting: "soft cinematic glow with subtle magical atmosphere",
    textTreatment: "if memorial text is used, keep it small and elegant, not like a comic title",
    negativeGuidance:
      "avoid exaggerated action poses, harsh cel shading, fan-art clichés, oversized heads, and busy fantasy clutter",
    palette: ["#f7cad0", "#cdb4db", "#84a59d"],
  },
  MINIMALIST: {
    label: "Minimalist",
    shortDescription: "Clean line art for a modern home.",
    guidance:
      "A refined minimal line-art portrait with restrained color, negative space, elegant contour lines, and a contemporary gallery feel.",
    emotionalTone: "calm, refined, and design-forward",
    composition: "simple centered portrait with generous negative space",
    background: "clean white or warm-paper background with almost no ornament",
    lighting: "subtle tonal variation only, letting linework carry the image",
    textTreatment: "if memorial text is used, place it as a tasteful caption beneath the art",
    negativeGuidance:
      "avoid clutter, photorealism, thick comic outlines, too many colors, and decorative excess",
    palette: ["#f8f5f2", "#7c9885", "#3d3d3d"],
  },
};

export const PACKAGE_PRICING: Record<
  PackageType,
  { amount: number; label: string; portraitCount: number }
> = {
  SINGLE: { amount: 999, label: "Single Portrait", portraitCount: 1 },
  MEMORIAL: { amount: 2999, label: "Memorial Package", portraitCount: 5 },
  PREMIUM: { amount: 4999, label: "Premium Package", portraitCount: 10 },
};

export const MEMORIAL_CURATED_STYLES: PortraitStyle[] = [
  PortraitStyle.WATERCOLOR,
  PortraitStyle.OIL_PAINTING,
  PortraitStyle.RAINBOW_BRIDGE,
  PortraitStyle.PENCIL_SKETCH,
  PortraitStyle.IMPRESSIONIST,
];

export const ALL_STYLES: PortraitStyle[] = Object.keys(STYLE_DEFINITIONS) as PortraitStyle[];

export function getPackageStyles(
  packageType: PackageType,
  selectedStyle?: PortraitStyle | null,
): PortraitStyle[] {
  if (packageType === PackageType.SINGLE) {
    if (!selectedStyle) {
      throw new Error("A style is required for single portrait orders.");
    }

    return [selectedStyle];
  }

  if (packageType === PackageType.MEMORIAL) {
    return MEMORIAL_CURATED_STYLES;
  }

  return ALL_STYLES;
}

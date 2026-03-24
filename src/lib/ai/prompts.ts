import { STYLE_GUIDES } from "./style-guides.js";
import { LAYOUT_GUIDES } from "./layout-guides.js";
import { getCulturalGuide } from "./cultural-guides.js";
import { getSuitePackDesignRole, resolveSuitePack } from "./suite-packs.js";
import { describeZones } from "../text/layout.js";

export interface DesignPrompt {
  systemPrompt: string;
  contentPrompt: string;
  /** true when text will be composited programmatically */
  textFree: boolean;
}

/**
 * Build the Gemini prompt for a design generation request.
 *
 * When languages include Arabic or Hindi, generates a text-free background
 * (text composited later via Sharp). English-only designs can render text
 * natively in the image for simpler output.
 */
export function buildDesignPrompt(
  projectType: string,
  designType: string,
  style: string,
  textContent: Record<string, Record<string, string>>,
  languages: string[],
  metadata?: Record<string, unknown> | null,
): DesignPrompt {
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES.modern;
  const layoutGuide = LAYOUT_GUIDES[designType];
  const culturalGuide = getCulturalGuide(projectType, designType, languages, metadata);
  const ceremonyContext = getCeremonyContext(metadata);
  const suitePack = resolveSuitePack(projectType, metadata);
  const designRole = getSuitePackDesignRole(projectType, designType as never, metadata);

  if (!layoutGuide) throw new Error(`Unknown design type: ${designType}`);

  // Use text-free mode when Arabic or Hindi are included
  const textFree = languages.includes("ar") || languages.includes("hi");

  const contentPrompt = textFree
    ? buildBackgroundPrompt(layoutGuide, styleGuide, culturalGuide, ceremonyContext, suitePack, designRole, designType, languages)
    : buildFullPrompt(layoutGuide, styleGuide, culturalGuide, ceremonyContext, suitePack, designRole, textContent, languages);

  return { systemPrompt: styleGuide.systemPrompt, contentPrompt, textFree };
}

// ─── Text-Free Background Prompt ────────────────────────

function buildBackgroundPrompt(
  layoutGuide: { description: string; aspectRatio: string; rules: string },
  styleGuide: { description: string; colors: string },
  culturalGuide: { rules: string },
  ctx: CeremonyContextResult,
  suitePack: { label: string },
  designRole: string,
  designType: string,
  languages: string[],
): string {
  const zones = describeZones(designType);

  return `
Create a professional, print-ready ${layoutGuide.description} background for a ${ctx.tradition || "multicultural"} ${ctx.event || "celebration"}.

This design will have ${languages.join(" + ")} text composited on top programmatically, so generate only the visual design — ornamental borders, patterns, textures, motifs, and background treatment.

IMPORTANT: Do not render any text, letters, words, or characters in any language or script. Leave clean open space in these areas where text will be placed:
${zones}

ASPECT RATIO: ${layoutGuide.aspectRatio}
STYLE: ${styleGuide.description}
COLOR PALETTE: ${styleGuide.colors}
SUITE PACK: ${suitePack.label}
DESIGN ROLE IN PACK: ${designRole}

CEREMONY CONTEXT:
${ctx.lines}

LAYOUT RULES:
${layoutGuide.rules}

CULTURAL REQUIREMENTS:
${culturalGuide.rules}

The blank text areas should feel intentional — like a professionally designed template waiting for letterpress typography.
Use the cultural motifs, borders, and ornament to frame and guide the eye toward the blank zones.
`.trim();
}

// ─── Full Prompt (English-only, with text) ──────────────

function buildFullPrompt(
  layoutGuide: { description: string; aspectRatio: string; rules: string },
  styleGuide: { description: string; colors: string },
  culturalGuide: { rules: string },
  ctx: CeremonyContextResult,
  suitePack: { label: string },
  designRole: string,
  textContent: Record<string, Record<string, string>>,
  languages: string[],
): string {
  const textBlock = Object.entries(textContent)
    .map(([field, translations]) =>
      languages
        .map((lang) => {
          const value = translations[lang];
          return value ? `- ${field} (${lang}): "${value}"` : null;
        })
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return `
Create a professional, print-ready ${layoutGuide.description} for a ${ctx.tradition || "multicultural"} ${ctx.event || "celebration"}.

ASPECT RATIO: ${layoutGuide.aspectRatio}
STYLE: ${styleGuide.description}
COLOR PALETTE: ${styleGuide.colors}
SUITE PACK: ${suitePack.label}
DESIGN ROLE IN PACK: ${designRole}

CEREMONY CONTEXT:
${ctx.lines}

LANGUAGES: ${languages.join(", ")}
ENGLISH: Render in an elegant serif or display typeface matching the overall style.

TEXT TO RENDER (pixel-perfect and beautifully typeset):
${textBlock}

LAYOUT RULES:
${layoutGuide.rules}

CULTURAL REQUIREMENTS:
${culturalGuide.rules}

Render only the exact text specified above — no additions, no placeholders.
This asset must feel intentionally designed for its role in the ${suitePack.label}.
`.trim();
}

// ─── Ceremony Context Helper ────────────────────────────

interface CeremonyContextResult {
  tradition: string;
  event: string;
  lines: string;
}

function getCeremonyContext(metadata?: Record<string, unknown> | null): CeremonyContextResult {
  const tradition = String(metadata?.tradition ?? "");
  const event = String(metadata?.eventType ?? metadata?.occasionType ?? "");

  const contextLines = [
    tradition ? `- Tradition/community: ${tradition}` : null,
    metadata?.eventType ? `- Wedding event type: ${String(metadata.eventType)}` : null,
    metadata?.occasionType ? `- Baby occasion type: ${String(metadata.occasionType)}` : null,
    metadata?.additionalInfo ? `- Additional note: ${String(metadata.additionalInfo)}` : null,
  ].filter(Boolean);

  return {
    tradition,
    event,
    lines: contextLines.length > 0
      ? contextLines.join("\n")
      : "- No additional ceremony context provided. Stay elegant and neutral.",
  };
}

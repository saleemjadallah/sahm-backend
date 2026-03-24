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
 * Always generate a text-free background and composite exact text later.
 * This avoids placeholder or hallucinated typography from the image model.
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

  // Roll baby-suite cards onto model-rendered exact text.
  // Wedding and other non-baby surfaces stay on the deterministic overlay path.
  const useInlineBabyText = designType.startsWith("BABY_");
  const textFree = !useInlineBabyText;

  const contentPrompt = textFree
    ? buildBackgroundPrompt(layoutGuide, styleGuide, culturalGuide, ceremonyContext, suitePack, designRole, designType, languages)
    : useInlineBabyText
      ? buildBabyInlineTextPrompt(
          designType,
          layoutGuide,
          styleGuide,
          culturalGuide,
          ceremonyContext,
          suitePack,
          designRole,
          textContent,
          languages,
        )
      : buildFullPrompt(
          layoutGuide,
          styleGuide,
          culturalGuide,
          ceremonyContext,
          suitePack,
          designRole,
          textContent,
          languages,
        );

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

function buildBabyInlineTextPrompt(
  designType: string,
  layoutGuide: { description: string; aspectRatio: string; rules: string },
  styleGuide: { description: string; colors: string },
  culturalGuide: { rules: string },
  ctx: CeremonyContextResult,
  suitePack: { label: string },
  designRole: string,
  textContent: Record<string, Record<string, string>>,
  languages: string[],
): string {
  const config = getBabyInlinePromptConfig(designType);
  const exactFieldLines = config.fields
    .map(({ field, label }) => renderFieldValue(field, label, textContent, languages))
    .filter(Boolean)
    .join("\n");

  return `
Create a professional, print-ready ${layoutGuide.description} for a ${ctx.tradition || "multicultural"} ${ctx.event || "celebration"}.

You must typeset the provided text directly into the card artwork.

ASPECT RATIO: ${layoutGuide.aspectRatio}
STYLE: ${styleGuide.description}
COLOR PALETTE: ${styleGuide.colors}
SUITE PACK: ${suitePack.label}
DESIGN ROLE IN PACK: ${designRole}

CEREMONY CONTEXT:
${ctx.lines}

LANGUAGES: ${languages.join(", ")}

MANDATORY TEXT RULES:
- Use the exact text strings below verbatim.
- Do not paraphrase, translate again, correct, improve, shorten, or expand any text.
- Do not invent placeholder labels like "babyName", "birthDate", "weight", "length", "name", or similar.
- Do not add extra headings, blessings, captions, or decorative words unless they appear exactly in the provided text.
- Do not recreate the text with alternate spellings. Copy the exact strings only.
- Keep all text crisp, elegant, and fully legible inside the intended decorative frames.
- If multiple languages are provided for the same field, stack them cleanly within the same frame with the primary language most prominent.
- Prefer fewer, better text blocks over clutter. If a field is not provided, leave that space decorative and empty.

PLACE THE EXACT TEXT IN THESE FIELDS:
${exactFieldLines}

LAYOUT INSTRUCTIONS:
${config.instructions.map((line) => `- ${line}`).join("\n")}

LAYOUT RULES:
${layoutGuide.rules}

CULTURAL REQUIREMENTS:
${culturalGuide.rules}

This must look like a finished luxury birth announcement card, not a blank template.
`.trim();
}

function getBabyInlinePromptConfig(designType: string): {
  fields: Array<{ field: string; label: string }>;
  instructions: string[];
} {
  switch (designType) {
    case "BABY_BIRTH_ANNOUNCEMENT":
      return {
        fields: [
          { field: "babyName", label: "Top hero cartouche" },
          { field: "birthDate", label: "Birth date box" },
          { field: "birthTime", label: "Birth time box" },
          { field: "weight", label: "Weight box" },
          { field: "length", label: "Length box" },
          { field: "parentNames", label: "Parents / family plaque" },
          { field: "additionalInfo", label: "Bottom message panel" },
        ],
        instructions: [
          "Top hero cartouche: the baby's name only, centered and most prominent.",
          "Middle four-box details panel: birth date, birth time, weight, and length in separate compartments.",
          "Lower ornamental plaque: parents / family names only.",
          "Bottom rectangular message panel: additional note only.",
          "Leave unused frames empty if no exact text is provided for that field.",
        ],
      };
    case "BABY_NURSERY_ART":
      return {
        fields: [
          { field: "babyName", label: "Main decorative name area" },
          { field: "additionalInfo", label: "Optional small supporting line" },
        ],
        instructions: [
          "The baby's name is the hero and should dominate the composition.",
          "Treat this like premium nursery art, not an information card.",
          "Any supporting note must stay small, subtle, and secondary.",
          "Do not force birth stats onto this design unless they fit elegantly.",
        ],
      };
    case "BABY_AQEEQAH_INVITE":
      return {
        fields: [
          { field: "babyName", label: "Invitation hero name area" },
          { field: "birthDate", label: "Date field" },
          { field: "birthTime", label: "Time field" },
          { field: "parentNames", label: "Hosting family line" },
          { field: "additionalInfo", label: "Invitation note area" },
        ],
        instructions: [
          "Use a clear invitation hierarchy with the baby's name most prominent.",
          "Present date and time as structured invitation details.",
          "Use the family line as a hosting signature, not the main headline.",
          "If there is no exact ceremony heading provided, do not invent one.",
        ],
      };
    case "BABY_MILESTONE_CARD":
      return {
        fields: [
          { field: "babyName", label: "Primary name area" },
          { field: "additionalInfo", label: "Milestone statement area" },
        ],
        instructions: [
          "The milestone statement and baby's name should feel bold and shareable.",
          "Keep the composition simple and high-contrast for social sharing.",
          "Do not introduce extra baby stats or family details unless they are explicitly provided and fit cleanly.",
        ],
      };
    case "BABY_WHATSAPP_CARD":
      return {
        fields: [
          { field: "babyName", label: "Hero name area" },
          { field: "birthDate", label: "Date field" },
          { field: "weight", label: "Weight field" },
          { field: "parentNames", label: "Family line" },
          { field: "additionalInfo", label: "Optional supporting note" },
        ],
        instructions: [
          "Make the baby's name immediately readable on a phone screen.",
          "Keep date and weight compact, clear, and visually separated.",
          "Use the family line as a secondary supporting element.",
          "Avoid clutter and leave unused decorative areas empty.",
        ],
      };
    case "BABY_THANK_YOU":
      return {
        fields: [
          { field: "babyName", label: "Name area" },
          { field: "parentNames", label: "Family signature line" },
          { field: "additionalInfo", label: "Thank-you message panel" },
        ],
        instructions: [
          "This should read as a warm thank-you card, not an announcement grid.",
          "Baby name first, message second, family signature last.",
          "Keep the wording intimate and spacious, with generous breathing room.",
        ],
      };
    default:
      return {
        fields: Object.keys(textContentFieldOrder).map((field) => ({
          field,
          label: field,
        })),
        instructions: [
          "Use a clear visual hierarchy with the baby's name most prominent.",
          "Typeset only the provided fields and leave all unused spaces empty.",
        ],
      };
  }
}

const textContentFieldOrder: Record<string, true> = {
  babyName: true,
  birthDate: true,
  birthTime: true,
  weight: true,
  length: true,
  parentNames: true,
  additionalInfo: true,
};

function renderFieldValue(
  field: string,
  label: string,
  textContent: Record<string, Record<string, string>>,
  languages: string[],
): string | null {
  const values = textContent[field];
  if (!values) return null;

  const lines = languages
    .map((lang) => {
      const value = values[lang];
      return value ? `  - ${lang}: "${value}"` : null;
    })
    .filter(Boolean);

  if (!lines.length) return null;
  return `${label}:\n${lines.join("\n")}`;
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

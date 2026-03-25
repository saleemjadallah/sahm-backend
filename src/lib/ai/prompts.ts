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
 * Build the Gemini prompt for a design generation request.
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

  // Roll exact-text model rendering out to the full catalog.
  const textFree = false;
  const contentPrompt = designType.startsWith("BABY_")
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
    : buildWeddingInlineTextPrompt(
        designType,
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
    .map(({ field, label, languages: fieldLanguages }) =>
      renderFieldValue(field, label, textContent, languages, fieldLanguages),
    )
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
${config.typographyRules.map((line) => `- ${line}`).join("\n")}

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

function buildWeddingInlineTextPrompt(
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
  const config = getWeddingInlinePromptConfig(designType);
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
- Do not invent placeholder labels, RSVP fields, menu items, table numbers, or decorative copy unless they appear exactly in the provided text.
- Do not add extra headings, blessings, captions, or filler words unless they are part of the exact text below.
- Do not recreate the text with alternate spellings. Copy the exact strings only.
- Keep all text crisp, elegant, and fully legible in the intended hierarchy.
- If multiple languages are provided for the same field, stack them cleanly with the primary language most prominent.
- If a field is not provided, leave that area decorative and empty instead of inventing content.

PLACE THE EXACT TEXT IN THESE FIELDS:
${exactFieldLines}

LAYOUT INSTRUCTIONS:
${config.instructions.map((line) => `- ${line}`).join("\n")}

LAYOUT RULES:
${layoutGuide.rules}

CULTURAL REQUIREMENTS:
${culturalGuide.rules}

This must look like a finished luxury stationery design, not a blank template.
`.trim();
}

function getBabyInlinePromptConfig(designType: string): {
  fields: Array<{ field: string; label: string; languages?: string[] }>;
  instructions: string[];
  typographyRules: string[];
} {
  switch (designType) {
    case "BABY_BIRTH_ANNOUNCEMENT":
      return {
        fields: [
          { field: "babyName", label: "Top hero cartouche", languages: ["en", "hi"] },
          { field: "birthDate", label: "Birth date box" },
          { field: "birthTime", label: "Birth time box" },
          { field: "weight", label: "Weight box" },
          { field: "length", label: "Length box" },
          { field: "parentNames", label: "Parents / family plaque" },
          { field: "additionalInfo", label: "Bottom message panel" },
        ],
        instructions: [
          "Top hero cartouche: render only the non-Arabic baby name lines centered in the upper portion.",
          "Leave a clean centered line in the lower portion of the hero cartouche for production Arabic calligraphy overlay. Do not render the Arabic hero name yourself.",
          "Middle four-box details panel: birth date, birth time, weight, and length in separate compartments.",
          "Lower ornamental plaque: parents / family names only.",
          "Bottom rectangular message panel: additional note only.",
          "Leave unused frames empty if no exact text is provided for that field.",
        ],
        typographyRules: [
          "For Arabic-script text on this card only, render the Arabic lines in elegant calligraphic styling while preserving the exact letters, spacing intent, and RTL reading order.",
          "Do not rewrite, summarize, ornamentally substitute, or regenerate any Arabic words. The calligraphic treatment must use the exact provided Arabic strings only.",
          "Especially in the hero name area, make the Arabic line feel like premium keepsake calligraphy while remaining fully legible and faithful to the provided text.",
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
        typographyRules: [],
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
        typographyRules: [],
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
        typographyRules: [],
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
        typographyRules: [],
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
        typographyRules: [],
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
        typographyRules: [],
      };
  }
}

function getWeddingInlinePromptConfig(designType: string): {
  fields: Array<{ field: string; label: string }>;
  instructions: string[];
} {
  switch (designType) {
    case "WEDDING_INVITATION":
      return {
        fields: [
          { field: "groomName", label: "Primary couple name area" },
          { field: "brideName", label: "Secondary couple name area" },
          { field: "date", label: "Date line" },
          { field: "time", label: "Time line" },
          { field: "venue", label: "Venue line" },
          { field: "city", label: "City line" },
          { field: "familyName", label: "Family line" },
          { field: "additionalInfo", label: "Additional note line" },
        ],
        instructions: [
          "Couple names are the hero and should dominate the card.",
          "Date, time, venue, and city belong in a structured details block below.",
          "Family names and additional note should stay secondary and elegant.",
        ],
      };
    case "WEDDING_SAVE_THE_DATE":
      return {
        fields: [
          { field: "date", label: "Hero date area" },
          { field: "groomName", label: "Partner one name line" },
          { field: "brideName", label: "Partner two name line" },
          { field: "venue", label: "Venue line" },
        ],
        instructions: [
          "The date is the single most prominent element.",
          "Names are secondary and venue is optional support.",
          "Keep the composition sparse, elegant, and teaser-like.",
        ],
      };
    case "WEDDING_RSVP_CARD":
      return {
        fields: [
          { field: "groomName", label: "Couple line" },
          { field: "brideName", label: "Couple line continuation" },
          { field: "date", label: "Event date line" },
          { field: "venue", label: "Venue line" },
          { field: "additionalInfo", label: "RSVP note area" },
        ],
        instructions: [
          "Keep the layout clean and response-card-like.",
          "Use the couple and event details as context, not as oversized hero text.",
          "Do not invent response fields beyond the exact text provided.",
        ],
      };
    case "WEDDING_MENU_CARD":
      return {
        fields: [
          { field: "groomName", label: "Optional header name line" },
          { field: "additionalInfo", label: "Main menu/message area" },
        ],
        instructions: [
          "Treat the supplied text as the menu/message content.",
          "Keep ornament restrained and typography refined.",
          "Do not invent courses or dish names unless they are in the exact text provided.",
        ],
      };
    case "WEDDING_TABLE_NUMBER":
      return {
        fields: [
          { field: "additionalInfo", label: "Central table number / label area" },
        ],
        instructions: [
          "Use one large centered text block only.",
          "If no exact label is provided, leave the design decorative and minimal.",
        ],
      };
    case "WEDDING_WELCOME_SIGN":
      return {
        fields: [
          { field: "groomName", label: "Primary couple name area" },
          { field: "brideName", label: "Secondary couple name area" },
          { field: "date", label: "Date line" },
          { field: "venue", label: "Venue line" },
        ],
        instructions: [
          "This should feel grand and entrance-worthy.",
          "Couple names are large and readable from a distance.",
          "Date and venue stay secondary but still clear.",
        ],
      };
    case "WEDDING_THANK_YOU":
      return {
        fields: [
          { field: "groomName", label: "Partner one name area" },
          { field: "brideName", label: "Partner two name area" },
          { field: "additionalInfo", label: "Thank-you message area" },
        ],
        instructions: [
          "Keep this warm, intimate, and lighter than the invitation.",
          "The gratitude message is the emotional center.",
          "Names should support the message, not overpower it.",
        ],
      };
    case "WEDDING_INSTAGRAM_POST":
      return {
        fields: [
          { field: "groomName", label: "Primary hero name area" },
          { field: "brideName", label: "Secondary hero name area" },
          { field: "date", label: "Supporting date line" },
        ],
        instructions: [
          "Make the couple names immediately readable on social.",
          "Keep copy minimal and high-impact.",
          "Do not overload the canvas with supporting details.",
        ],
      };
    case "WEDDING_WHATSAPP_CARD":
      return {
        fields: [
          { field: "groomName", label: "Primary hero name area" },
          { field: "brideName", label: "Secondary hero name area" },
          { field: "date", label: "Date line" },
          { field: "venue", label: "Venue line" },
        ],
        instructions: [
          "Optimize for quick reading on a phone screen.",
          "Names should be large and date/venue should be clear and compact.",
          "Avoid clutter and keep the card teaser-like.",
        ],
      };
    default:
      return {
        fields: Object.keys(textContentFieldOrder).map((field) => ({
          field,
          label: field,
        })),
        instructions: [
          "Use a clear visual hierarchy with the most important names or details most prominent.",
          "Typeset only the provided fields and leave unused areas empty.",
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
  fieldLanguages?: string[],
): string | null {
  const values = textContent[field];
  if (!values) return null;

  const langs = fieldLanguages?.length ? languages.filter((lang) => fieldLanguages.includes(lang)) : languages;
  const lines = langs
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

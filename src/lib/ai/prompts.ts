import { STYLE_GUIDES } from "./style-guides.js";
import { LAYOUT_GUIDES } from "./layout-guides.js";
import { getCulturalGuide } from "./cultural-guides.js";
import { getSuitePackDesignRole, resolveSuitePack } from "./suite-packs.js";

/**
 * Build the complete Gemini prompt for a design generation request.
 */
export function buildDesignPrompt(
  projectType: string,
  designType: string,
  style: string,
  textContent: Record<string, Record<string, string>>,
  languages: string[],
  metadata?: Record<string, unknown> | null,
): string {
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES.modern;
  const layoutGuide = LAYOUT_GUIDES[designType];
  const culturalGuide = getCulturalGuide(projectType, designType, languages, metadata);
  const languageRules = getLanguageRenderingRules(languages);
  const ceremonyContext = getCeremonyContext(metadata);
  const suitePack = resolveSuitePack(projectType, metadata);
  const designRole = getSuitePackDesignRole(projectType, designType as never, metadata);

  if (!layoutGuide) {
    throw new Error(`Unknown design type: ${designType}`);
  }

  const textBlock = Object.entries(textContent)
    .map(([field, translations]) => {
      return languages
        .map((lang) => {
          const value = translations[lang];
          return value ? `- ${field} (${lang}): "${value}"` : null;
        })
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `
${styleGuide.systemPrompt}

Create a ${layoutGuide.description} with the following specifications:

DESIGN TYPE: ${designType}
ASPECT RATIO: ${layoutGuide.aspectRatio}
STYLE: ${styleGuide.description}
COLOR PALETTE: ${styleGuide.colors}
SUITE PACK: ${suitePack.label}
DESIGN ROLE IN PACK: ${designRole}

CEREMONY CONTEXT:
${ceremonyContext}

LANGUAGES TO RENDER: ${languages.join(", ")}
${languageRules}

TEXT TO RENDER (must be pixel-perfect, legible, and beautifully typeset):
${textBlock}

LAYOUT RULES:
${layoutGuide.rules}

CULTURAL REQUIREMENTS:
${culturalGuide.rules}

CRITICAL:
- Each language must be rendered in its native script and direction
- Arabic text must be RIGHT-TO-LEFT with proper letter connections
- Hindi/Devanagari text must use proper matras, conjuncts, and shirorekha (headline)
- English text uses standard left-to-right
- Language hierarchy in the design: the FIRST language in the list should be largest/most prominent
- If multiple languages are present, they should be clearly separated but visually harmonious
- All scripts must look like they were typeset by a native designer, not machine-translated
- The design must be print-ready quality with no text artifacts or broken characters
- Do NOT include any placeholder text \u2014 only the exact text specified above
- Do NOT add any religious phrase, symbol, or header unless it is supported by the ceremony context above
- This asset must feel intentionally designed for its specific role in the selected suite pack, not like a generic recycled template
`.trim();
}

/**
 * Build language-specific rendering instructions.
 */
function getLanguageRenderingRules(languages: string[]): string {
  const rules: string[] = [];

  if (languages.includes("ar")) {
    rules.push(
      "ARABIC: Render in beautiful calligraphy (Thuluth, Diwani, or Naskh depending on style). RTL direction. Ensure all letter connections are intact.",
    );
  }
  if (languages.includes("hi")) {
    rules.push(
      "HINDI: Render in elegant Devanagari script. Use a refined typeface style \u2014 not basic. The shirorekha (top line) must be continuous and clean. Ensure proper rendering of matras and conjunct consonants.",
    );
  }
  if (languages.includes("en")) {
    rules.push(
      "ENGLISH: Render in an elegant serif or display typeface matching the overall style. LTR direction.",
    );
  }

  if (languages.length > 1) {
    rules.push(
      "MULTILINGUAL LAYOUT: Separate languages visually with clear spacing or subtle dividers. The primary language (first in list) should be 1.5-2x larger than secondary languages. Maintain visual harmony between scripts.",
    );
  }

  return rules.join("\n");
}

function getCeremonyContext(metadata?: Record<string, unknown> | null): string {
  if (!metadata) {
    return "- No additional ceremony context provided. Stay elegant and neutral.";
  }

  const contextLines = [
    metadata.tradition ? `- Tradition/community: ${String(metadata.tradition)}` : null,
    metadata.eventType ? `- Wedding event type: ${String(metadata.eventType)}` : null,
    metadata.occasionType ? `- Baby occasion type: ${String(metadata.occasionType)}` : null,
    metadata.additionalInfo ? `- Additional note: ${String(metadata.additionalInfo)}` : null,
  ].filter(Boolean);

  if (contextLines.length === 0) {
    return "- No additional ceremony context provided. Stay elegant and neutral.";
  }

  return contextLines.join("\n");
}

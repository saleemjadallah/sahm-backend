import sharp from "sharp";
import { buildFontFaces, getFontFamily, fontForLang, type FontKey } from "./fonts.js";
import { getTextLayout, type TextZone } from "./layout.js";

interface TextContent {
  [field: string]: Record<string, string>;
}

interface CompositeOpts {
  background: Buffer;
  designType: string;
  textContent: TextContent;
  languages: string[];       // ordered — first is primary
  colorOverride?: string;    // optional hex to override all text color
}

/**
 * Composite programmatic text onto an AI-generated background image.
 * Returns the final image buffer (PNG).
 */
export async function compositeText(opts: CompositeOpts): Promise<Buffer> {
  const { background, designType, textContent, languages, colorOverride } = opts;
  const layout = getTextLayout(designType);
  if (!layout) return background; // no layout defined — return background as-is

  // Get background dimensions
  const meta = await sharp(background).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Collect which fonts we need
  const fontKeys = new Set<FontKey>();
  for (const lang of languages) {
    fontKeys.add(fontForLang(lang, "display"));
    fontKeys.add(fontForLang(lang, "body"));
  }

  // Build SVG with embedded fonts and text
  const fontFaceCSS = buildFontFaces([...fontKeys]);
  const textElements = buildTextElements(layout.zones, textContent, languages, width, height, colorOverride);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><style>${fontFaceCSS}</style></defs>
  ${textElements}
</svg>`;

  // Composite SVG text layer onto background
  return sharp(background)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ─── Build SVG text elements ────────────────────────────

function buildTextElements(
  zones: TextZone[],
  textContent: TextContent,
  languages: string[],
  width: number,
  height: number,
  colorOverride?: string,
): string {
  const elements: string[] = [];
  const primaryLang = languages[0];
  const secondaryLangs = languages.slice(1);

  for (const zone of zones) {
    const fieldData = textContent[zone.field];
    if (!fieldData) continue;

    const primaryText = fieldData[primaryLang] || fieldData.en || "";
    if (!primaryText && !secondaryLangs.some((l) => fieldData[l])) continue;

    const xPct = zone.align === "center" ? 50 : zone.align === "right" ? 85 : 15;
    const fontSize = Math.round(height * zone.fontSizePct / 100);
    const color = colorOverride || zone.color;
    const anchor = zone.align === "center" ? "middle" : zone.align === "right" ? "end" : "start";
    const maxWidth = Math.round(width * zone.maxWidthPct / 100);

    let yOffset = Math.round(height * zone.yPct / 100);

    // Render primary language
    if (primaryText) {
      const font = fontForLang(primaryLang, zone.fontRole);
      const dir = primaryLang === "ar" ? "rtl" : "ltr";
      elements.push(textEl(primaryText, xPct, yOffset, fontSize, getFontFamily(font), color, anchor, dir, maxWidth, width));
      yOffset += Math.round(fontSize * 1.4);
    }

    // Render secondary languages below, smaller
    for (const lang of secondaryLangs) {
      const text = fieldData[lang];
      if (!text) continue;

      const secFontSize = Math.round(fontSize * zone.secondaryScale);
      const font = fontForLang(lang, zone.fontRole);
      const dir = lang === "ar" ? "rtl" : "ltr";
      elements.push(textEl(text, xPct, yOffset, secFontSize, getFontFamily(font), color, anchor, dir, maxWidth, width));
      yOffset += Math.round(secFontSize * 1.4);
    }
  }

  return elements.join("\n  ");
}

function textEl(
  text: string,
  xPct: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  color: string,
  anchor: string,
  direction: string,
  _maxWidth: number,
  _imgWidth: number,
): string {
  const escaped = escapeXml(text);
  const bidi = direction === "rtl" ? ` unicode-bidi="bidi-override"` : "";
  return `<text x="${xPct}%" y="${y}" font-family="'${fontFamily}'" font-size="${fontSize}" fill="${color}" text-anchor="${anchor}" direction="${direction}"${bidi} dominant-baseline="central">${escaped}</text>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

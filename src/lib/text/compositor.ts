import sharp from "sharp";
import { buildFontFaces, getFontFamily, fontForLang, type FontKey } from "./fonts.js";

// TextZone type — previously in layout.ts, now inline since layouts are category-driven
export interface TextZone {
  field: string;
  yPct: number;
  fontSizePct: number;
  fontSizeMaxPct?: number;
  fontSizeMinPct?: number;
  fontRole: "display" | "body";
  fontKey?: FontKey;
  color: string;
  align: "center" | "left" | "right";
  maxWidthPct: number;
  secondaryScale: number;
  lineClamp?: number;
  box?: {
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    paddingPct?: number;
  };
}

export interface TextLayout {
  zones: TextZone[];
}

interface TextContent {
  [field: string]: Record<string, string>;
}

interface CompositeOpts {
  background: Buffer;
  layout: TextLayout;        // now passed in, not looked up by designType
  textContent: TextContent;
  languages: string[];       // ordered — first is primary
  colorOverride?: string;
}

interface ClearZonesOpts {
  background: Buffer;
  layout: TextLayout;        // now passed in
  fields: string[];
  fill?: string;
  opacity?: number;
}

/**
 * Composite programmatic text onto an AI-generated background image.
 * Returns the final image buffer (PNG).
 */
export async function compositeText(opts: CompositeOpts): Promise<Buffer> {
  const { background, layout, textContent, languages, colorOverride } = opts;
  if (!layout || !layout.zones.length) return background;

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
  for (const zone of layout.zones) {
    if (zone.fontKey) fontKeys.add(zone.fontKey);
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

export async function clearTextZones(opts: ClearZonesOpts): Promise<Buffer> {
  const { background, layout, fields, fill = "#fbf7f0", opacity = 0.96 } = opts;
  if (!layout || !layout.zones.length) return background;

  const meta = await sharp(background).metadata();
  const width = meta.width!;
  const height = meta.height!;

  const rects = layout.zones
    .filter((zone) => zone.box && fields.includes(zone.field))
    .map((zone) => {
      const box = zone.box!;
      const x = Math.round(width * box.xPct / 100);
      const y = Math.round(height * box.yPct / 100);
      const w = Math.round(width * box.widthPct / 100);
      const h = Math.round(height * box.heightPct / 100);
      const rx = Math.max(8, Math.round(Math.min(w, h) * 0.16));
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}" fill-opacity="${opacity}" />`;
    })
    .join("\n  ");

  if (!rects) return background;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${rects}
</svg>`;

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

    if (zone.box) {
      elements.push(
        ...textBoxEls(zone, fieldData, primaryLang, secondaryLangs, width, height, colorOverride),
      );
      continue;
    }

    const xPct = zone.align === "center" ? 50 : zone.align === "right" ? 85 : 15;
    const fontSize = Math.round(height * zone.fontSizePct / 100);
    const color = colorOverride || zone.color;
    const anchor = zone.align === "center" ? "middle" : zone.align === "right" ? "end" : "start";
    const maxWidth = Math.round(width * zone.maxWidthPct / 100);

    let yOffset = Math.round(height * zone.yPct / 100);

    // Render primary language
    if (primaryText) {
      const font = zone.fontKey ?? fontForLang(primaryLang, zone.fontRole);
      const dir = primaryLang === "ar" ? "rtl" : "ltr";
      elements.push(textEl(primaryText, xPct, yOffset, fontSize, getFontFamily(font), color, anchor, dir, maxWidth, width));
      yOffset += Math.round(fontSize * 1.4);
    }

    // Render secondary languages below, smaller
    for (const lang of secondaryLangs) {
      const text = fieldData[lang];
      if (!text) continue;

      const secFontSize = Math.round(fontSize * zone.secondaryScale);
      const font = zone.fontKey ?? fontForLang(lang, zone.fontRole);
      const dir = lang === "ar" ? "rtl" : "ltr";
      elements.push(textEl(text, xPct, yOffset, secFontSize, getFontFamily(font), color, anchor, dir, maxWidth, width));
      yOffset += Math.round(secFontSize * 1.4);
    }
  }

  return elements.join("\n  ");
}

function textBoxEls(
  zone: TextZone,
  fieldData: Record<string, string>,
  primaryLang: string,
  secondaryLangs: string[],
  width: number,
  height: number,
  colorOverride?: string,
): string[] {
  const box = zone.box;
  if (!box) return [];

  const lines: string[] = [];
  const boxX = Math.round(width * box.xPct / 100);
  const boxY = Math.round(height * box.yPct / 100);
  const boxWidth = Math.round(width * box.widthPct / 100);
  const boxHeight = Math.round(height * box.heightPct / 100);
  const padding = Math.round(width * (box.paddingPct ?? 2) / 100);
  const usableWidth = Math.max(60, boxWidth - (padding * 2));
  const usableHeight = Math.max(20, boxHeight - (padding * 2));
  const centerX = boxX + (boxWidth / 2);
  const color = colorOverride || zone.color;

  const textEntries: Array<{
    text: string;
    lang: string;
    role: "primary" | "secondary";
  }> = [];

  const primaryText = fieldData[primaryLang] || fieldData.en || "";
  if (primaryText) {
    textEntries.push({ text: primaryText, lang: primaryLang, role: "primary" });
  }

  for (const lang of secondaryLangs) {
    const text = fieldData[lang];
    if (text) {
      textEntries.push({ text, lang, role: "secondary" });
    }
  }

  if (!textEntries.length) return [];

  const maxFontSize = Math.max(
    14,
    Math.round(height * (zone.fontSizeMaxPct ?? zone.fontSizePct) / 100),
  );
  const minFontSize = Math.max(
    10,
    Math.round(height * (zone.fontSizeMinPct ?? Math.max(zone.fontSizePct * 0.6, 1.3)) / 100),
  );

  let fitted = fitTextEntries(textEntries, zone, usableWidth, usableHeight, maxFontSize, minFontSize);
  if (!fitted) {
    fitted = fitTextEntries(textEntries, zone, usableWidth, usableHeight, minFontSize, minFontSize);
  }
  if (!fitted) return [];

  const totalHeight = fitted.blocks.reduce((sum, block) => sum + block.totalHeight, 0)
    + Math.max(0, fitted.blocks.length - 1) * Math.round(fitted.baseFontSize * 0.28);
  let cursorY = boxY + padding + ((usableHeight - totalHeight) / 2);

  for (let blockIndex = 0; blockIndex < fitted.blocks.length; blockIndex++) {
    const block = fitted.blocks[blockIndex];
    const font = zone.fontKey ?? fontForLang(block.lang, zone.fontRole);

    for (const line of block.lines) {
      const lineCenterY = cursorY + (block.lineHeight / 2);
      lines.push(
        textEl(
          line,
          (centerX / width) * 100,
          lineCenterY,
          block.fontSize,
          getFontFamily(font),
          color,
          "middle",
          block.lang === "ar" ? "rtl" : "ltr",
          usableWidth,
          width,
        ),
      );
      cursorY += block.lineHeight;
    }

    if (blockIndex < fitted.blocks.length - 1) {
      cursorY += Math.round(fitted.baseFontSize * 0.28);
    }
  }

  return lines;
}

function fitTextEntries(
  entries: Array<{ text: string; lang: string; role: "primary" | "secondary" }>,
  zone: TextZone,
  usableWidth: number,
  usableHeight: number,
  maxFontSize: number,
  minFontSize: number,
): {
  baseFontSize: number;
  blocks: Array<{
    lines: string[];
    lang: string;
    fontSize: number;
    lineHeight: number;
    totalHeight: number;
  }>;
} | null {
  for (let baseFontSize = maxFontSize; baseFontSize >= minFontSize; baseFontSize -= 1) {
    const blocks: Array<{
      lines: string[];
      lang: string;
      fontSize: number;
      lineHeight: number;
      totalHeight: number;
    }> = [];

    let totalHeight = 0;
    let fits = true;

    for (const entry of entries) {
      const fontSize = entry.role === "primary"
        ? baseFontSize
        : Math.max(10, Math.round(baseFontSize * zone.secondaryScale));
      const lineHeight = Math.round(fontSize * (entry.role === "primary" ? 1.1 : 1.18));
      const wrapped = wrapText(entry.text, usableWidth, fontSize, zone.fontRole);
      if (!wrapped.length) continue;
      if (zone.lineClamp && wrapped.length > zone.lineClamp) {
        fits = false;
        break;
      }

      const blockHeight = wrapped.length * lineHeight;
      totalHeight += blockHeight;
      blocks.push({
        lines: wrapped,
        lang: entry.lang,
        fontSize,
        lineHeight,
        totalHeight: blockHeight,
      });
    }

    totalHeight += Math.max(0, blocks.length - 1) * Math.round(baseFontSize * 0.28);
    if (fits && totalHeight <= usableHeight) {
      return { baseFontSize, blocks };
    }
  }

  return null;
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontRole: "display" | "body",
): string[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [];

  const widthFactor = fontRole === "display" ? 0.58 : 0.54;
  const approxCharsPerLine = Math.max(3, Math.floor(maxWidth / (fontSize * widthFactor)));

  if (normalized.length <= approxCharsPerLine) {
    return [normalized];
  }

  const words = normalized.split(" ");
  if (words.length === 1) {
    return [normalized];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= approxCharsPerLine) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
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

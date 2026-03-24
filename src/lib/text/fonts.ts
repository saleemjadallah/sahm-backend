import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "../../../assets/fonts");

export type FontKey =
  | "arabic-naskh"
  | "arabic-naskh-bold"
  | "arabic-ruqaa"
  | "arabic-ruqaa-bold"
  | "devanagari"
  | "english-serif"
  | "english-body";

interface FontDef {
  file: string;
  family: string;
  weight: string;
}

const FONT_MAP: Record<FontKey, FontDef> = {
  "arabic-naskh":      { file: "Amiri-Regular.ttf",            family: "Amiri",              weight: "400" },
  "arabic-naskh-bold": { file: "Amiri-Bold.ttf",               family: "Amiri",              weight: "700" },
  "arabic-ruqaa":      { file: "ArefRuqaa-Regular.ttf",        family: "Aref Ruqaa",         weight: "400" },
  "arabic-ruqaa-bold": { file: "ArefRuqaa-Bold.ttf",           family: "Aref Ruqaa",         weight: "700" },
  "devanagari":        { file: "NotoSansDevanagari-Regular.ttf", family: "Noto Sans Devanagari", weight: "400" },
  "english-serif":     { file: "PlayfairDisplay-Regular.ttf",   family: "Playfair Display",   weight: "400" },
  "english-body":      { file: "Lora-Regular.ttf",              family: "Lora",               weight: "400" },
};

// Cache base64-encoded font data
const fontCache = new Map<FontKey, string>();

function loadFontBase64(key: FontKey): string {
  const cached = fontCache.get(key);
  if (cached) return cached;

  const def = FONT_MAP[key];
  const data = readFileSync(join(FONTS_DIR, def.file));
  const b64 = data.toString("base64");
  fontCache.set(key, b64);
  return b64;
}

/**
 * Build @font-face CSS declarations for embedding into SVG.
 * Only includes fonts actually needed for the given keys.
 */
export function buildFontFaces(keys: FontKey[]): string {
  const unique = [...new Set(keys)];
  return unique
    .map((key) => {
      const def = FONT_MAP[key];
      const b64 = loadFontBase64(key);
      return `@font-face { font-family: '${def.family}'; font-weight: ${def.weight}; src: url('data:font/truetype;base64,${b64}') format('truetype'); }`;
    })
    .join("\n");
}

export function getFontFamily(key: FontKey): string {
  return FONT_MAP[key].family;
}

/**
 * Pick the right font key for a language + role.
 */
export function fontForLang(lang: string, role: "display" | "body" = "body"): FontKey {
  if (lang === "ar") return role === "display" ? "arabic-ruqaa" : "arabic-naskh";
  if (lang === "hi") return "devanagari";
  return role === "display" ? "english-serif" : "english-body";
}

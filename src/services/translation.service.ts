import type { PrismaClient } from "@prisma/client";
import { callGeminiText } from "../lib/ai/gemini.js";
import { GeminiError } from "../errors/index.js";

// ─── Auto Translate / Transliterate ────────────────────

/**
 * Translate or transliterate text from one language to others.
 * - Names are transliterated (phonetic), not translated.
 * - Phrases, venues, and general text are translated.
 * - Results are cached in the TranslationCache table.
 */
export async function autoTranslate(
  prisma: PrismaClient,
  text: string,
  fieldType: "name" | "phrase" | "venue" | "general",
  fromLang: string,
  toLangs: string[],
  context?: string,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Check cache first for each target language
  const uncached: string[] = [];

  for (const toLang of toLangs) {
    const cached = await prisma.translationCache.findUnique({
      where: {
        input_fromLang_toLang_fieldType: {
          input: text,
          fromLang,
          toLang,
          fieldType,
        },
      },
    });

    if (cached) {
      results[toLang] = cached.output;
    } else {
      uncached.push(toLang);
    }
  }

  // If all cached, return immediately
  if (uncached.length === 0) {
    return results;
  }

  // Call Gemini for uncached translations
  const prompt = `
You are a professional translator and transliterator specializing in wedding and celebration stationery for Gulf and South Asian cultures.

TASK: ${fieldType === "name" ? "TRANSLITERATE" : "TRANSLATE"} the following from ${fromLang} to ${uncached.join(" and ")}.

Input: "${text}"
Field type: ${fieldType}
Context: ${context || "celebration design"}

RULES:
- For NAMES: transliterate phonetically, do NOT translate meaning.
  "Ahmed" -> Arabic: "\u0623\u062d\u0645\u062f" / Hindi: "\u0905\u0939\u092e\u0926"
  "Priya" -> Arabic: "\u0628\u0631\u064a\u0627" / Hindi: "\u092a\u094d\u0930\u093f\u092f\u093e"
  "Al-Rashid" -> Hindi: "\u0905\u0932-\u0930\u0936\u0940\u0926"
  "Sharma" -> Arabic: "\u0634\u0627\u0631\u0645\u0627"

- For PHRASES: translate meaning with cultural adaptation.
  "Save the Date" -> Arabic: "\u0627\u062d\u0641\u0638\u0648\u0627 \u0627\u0644\u062a\u0627\u0631\u064a\u062e" / Hindi: "\u0924\u093e\u0930\u0940\u0916\u093c \u092f\u093e\u0926 \u0930\u0916\u0947\u0902"
  "You are invited" -> Arabic: "\u062a\u062a\u0634\u0631\u0641 \u0628\u062f\u0639\u0648\u062a\u0643\u0645" / Hindi: "\u0906\u092a\u0915\u094b \u0938\u093e\u0926\u0930 \u0906\u092e\u0902\u0924\u094d\u0930\u093f\u0924 \u0915\u093f\u092f\u093e \u091c\u093e\u0924\u093e \u0939\u0948"

- For VENUES: transliterate venue names, translate generic words.
  "The Ritz-Carlton, Dubai" -> Arabic: "\u0641\u0646\u062f\u0642 \u0631\u064a\u062a\u0632 \u0643\u0627\u0631\u0644\u062a\u0648\u0646\u060c \u062f\u0628\u064a" / Hindi: "\u0926 \u0930\u093f\u091f\u094d\u091c\u093c-\u0915\u093e\u0930\u094d\u0932\u091f\u0928, \u0926\u0941\u092c\u0908"

Return ONLY a valid JSON object with language codes as keys:
${uncached.length === 1 ? `{"${uncached[0]}": "..."}` : `{"${uncached.join('": "...", "')}": "..."}`}
`;

  try {
    const response = await callGeminiText(prompt);
    const translated: Record<string, string> = JSON.parse(response);

    // Cache all new translations
    for (const toLang of uncached) {
      const output = translated[toLang] || text;
      results[toLang] = output;

      await prisma.translationCache.upsert({
        where: {
          input_fromLang_toLang_fieldType: {
            input: text,
            fromLang,
            toLang,
            fieldType,
          },
        },
        update: { output },
        create: {
          input: text,
          fromLang,
          toLang,
          fieldType,
          output,
        },
      });
    }

    return results;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new GeminiError("Failed to parse translation response from Gemini");
    }
    throw err;
  }
}

// ─── Batch UI Translation ──────────────────────────────

/**
 * Translate a batch of UI strings from English to a target language.
 * Called at build-time or on first request, then cached aggressively.
 */
export async function translateUIBatch(
  prisma: PrismaClient,
  strings: Record<string, string>,
  targetLang: "ar" | "hi",
): Promise<Record<string, string>> {
  // 1. Check cache first
  const cached = await prisma.translationCache.findMany({
    where: {
      fromLang: "en",
      toLang: targetLang,
      fieldType: "ui",
      input: { in: Object.values(strings) },
    },
  });

  const cachedMap = new Map(cached.map((c) => [c.input, c.output]));
  const uncachedEntries = Object.entries(strings).filter(
    ([_, val]) => !cachedMap.has(val),
  );

  // 2. If everything is cached, return immediately
  if (uncachedEntries.length === 0) {
    return Object.fromEntries(
      Object.entries(strings).map(([key, val]) => [key, cachedMap.get(val)!]),
    );
  }

  // 3. Batch-translate uncached strings via Gemini
  const uncachedObj = Object.fromEntries(uncachedEntries);
  const langName = targetLang === "ar" ? "Arabic" : "Hindi";

  const prompt = `
You are a professional UI translator for a premium Gulf life moments platform called "Sahm" (\u0633\u0647\u0645).

Translate the following UI strings from English to ${langName}.

RULES:
- These are UI labels, buttons, headings, and short phrases \u2014 keep translations concise.
- Use formal but warm tone \u2014 this is a luxury celebration brand, not a tech product.
- For Arabic: use Modern Standard Arabic that Gulf audiences find natural. RTL is handled by the app.
- For Hindi: use standard Hindi in Devanagari script. Avoid overly Sanskritized vocabulary.
- Do NOT translate brand names ("Sahm", "sahm.app").
- Keep placeholders like {name} or {count} intact.
- Return ONLY a valid JSON object mapping the same keys to translated values, no markdown fences.

Input:
${JSON.stringify(uncachedObj, null, 2)}
`;

  try {
    const response = await callGeminiText(prompt);
    const translated: Record<string, string> = JSON.parse(response);

    // 4. Cache all new translations
    await prisma.translationCache.createMany({
      data: uncachedEntries.map(([key, enVal]) => ({
        input: enVal,
        fromLang: "en",
        toLang: targetLang,
        fieldType: "ui",
        output: translated[key] || enVal,
      })),
      skipDuplicates: true,
    });

    // 5. Merge cached + freshly translated
    return Object.fromEntries(
      Object.entries(strings).map(([key, val]) => [
        key,
        cachedMap.get(val) || translated[key] || val,
      ]),
    );
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new GeminiError("Failed to parse UI translation response from Gemini");
    }
    throw err;
  }
}

import { GoogleGenAI, type Part } from "@google/genai";
import { env } from "../../config/env.js";
import { GeminiError } from "../../errors/index.js";

// ─── Initialize Gemini Client (lazy) ───────────────────

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    if (!env.GEMINI_API_KEY) throw new GeminiError("Gemini API key is not configured");
    _ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return _ai;
}

// ─── Concurrency Limiter (Semaphore Pattern) ───────────

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

const semaphore = new Semaphore(env.GEMINI_MAX_CONCURRENT);

// ─── Retry with Exponential Backoff ────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) break;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw new GeminiError(
    `Gemini API failed after ${maxAttempts} attempts: ${lastError?.message}`,
    { originalError: lastError?.message },
  );
}

// ─── Extract image buffer from Gemini response ─────────

function extractImage(candidates: any[] | undefined): Buffer {
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates returned from Gemini");
  }
  for (const part of candidates[0].content!.parts!) {
    if (part.inlineData && part.inlineData.mimeType?.startsWith("image/")) {
      if (!part.inlineData.data) throw new Error("Empty image data returned from Gemini");
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("No image data in Gemini response");
}

// ─── Generate Design Image ─────────────────────────────

export interface GenerateImageOpts {
  prompt: string;
  systemPrompt?: string;
  aspectRatio?: string;
  imageSize?: "512" | "1K" | "2K" | "4K";
  referenceImage?: Buffer;
}

export async function generateDesignImage(opts: GenerateImageOpts): Promise<Buffer> {
  await semaphore.acquire();

  try {
    return await withRetry(async () => {
      const parts: Part[] = [];

      if (opts.referenceImage) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: opts.referenceImage.toString("base64"),
          },
        });
      }

      parts.push({ text: opts.prompt });

      const response = await getAI().models.generateContent({
        model: env.GEMINI_IMAGE_MODEL,
        ...(opts.systemPrompt ? { systemInstruction: opts.systemPrompt } : {}),
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio: (opts.aspectRatio || "1:1") as any,
            imageSize: opts.imageSize || "2K",
          },
        },
      });

      return extractImage(response.candidates);
    });
  } finally {
    semaphore.release();
  }
}

// ─── Call Gemini Text Model ────────────────────────────

export async function callGeminiText(prompt: string): Promise<string> {
  await semaphore.acquire();

  try {
    return await withRetry(async () => {
      const response = await getAI().models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
      });

      const text = response.text;
      if (!text) throw new Error("Empty text response from Gemini");

      return text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    });
  } finally {
    semaphore.release();
  }
}

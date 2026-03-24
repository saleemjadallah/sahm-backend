import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env.js";
import { GeminiError } from "../../errors/index.js";

// ─── Initialize Gemini Client ──────────────────────────

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

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

      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
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

// ─── Generate Design Image ─────────────────────────────

export async function generateDesignImage(
  prompt: string,
  aspectRatio: string = "1:1",
): Promise<Buffer> {
  await semaphore.acquire();

  try {
    return await withRetry(async () => {
      const model = genAI.getGenerativeModel({
        model: env.GEMINI_IMAGE_MODEL,
        generationConfig: {
          // @ts-expect-error — Gemini SDK types may not include image generation config yet
          responseModalities: ["image", "text"],
        },
      });

      const result = await model.generateContent([
        {
          text: `${prompt}\n\nAspect ratio: ${aspectRatio}. Generate a high-quality image for this design.`,
        },
      ]);

      const response = result.response;
      const candidates = response.candidates;

      if (!candidates || candidates.length === 0) {
        throw new Error("No candidates returned from Gemini");
      }

      // Look for image parts in the response
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith("image/")) {
          const imageData = part.inlineData.data;
          if (!imageData) {
            throw new Error("Empty image data returned from Gemini");
          }
          return Buffer.from(imageData, "base64");
        }
      }

      throw new Error("No image data in Gemini response");
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
      const model = genAI.getGenerativeModel({
        model: env.GEMINI_MODEL,
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error("Empty text response from Gemini");
      }

      // Clean up response — remove markdown code fences if present
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

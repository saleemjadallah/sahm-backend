import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Semaphore } from "../lib/semaphore.js";

// Only 1 render at a time — Remotion is CPU/memory intensive
const renderSemaphore = new Semaphore(1);

// Cached bundle location — built once, reused across renders
let bundleLocation: string | null = null;

const REMOTION_ENTRY = resolve(
  import.meta.dirname,
  "../remotion/index.ts",
);

const BGM_PATH = resolve(
  import.meta.dirname,
  "../remotion/public/bgm-piano-reflections.mp3",
);

async function ensureBundle(): Promise<string> {
  if (bundleLocation) return bundleLocation;

  console.log("[video] Building Remotion bundle (first render)...");
  bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir: resolve(import.meta.dirname, "../remotion/public"),
  });
  console.log("[video] Bundle ready at:", bundleLocation);

  return bundleLocation;
}

export async function renderLetterVideo(options: {
  letterText: string;
  petName: string;
  memorialText: string | null;
  portraitImageBuffer: Buffer;
  narrationBuffer: Buffer;
  narrationDurationS: number;
}): Promise<Buffer> {
  return renderSemaphore.use(async () => {
    const bundlePath = await ensureBundle();

    // Create a temp directory for per-render dynamic assets
    const tmpDir = join(tmpdir(), `sahm-render-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });

    // Write dynamic assets into the bundle's public folder
    // We use the bundle's own public dir so staticFile() resolves them
    const publicDir = join(bundlePath, "public");
    mkdirSync(publicDir, { recursive: true });

    const portraitPath = join(publicDir, "portrait.png");
    const narrationPath = join(publicDir, "narration.mp3");
    const bgmDest = join(publicDir, "bgm-piano-reflections.mp3");

    try {
      writeFileSync(portraitPath, options.portraitImageBuffer);
      writeFileSync(narrationPath, options.narrationBuffer);

      // Ensure background music is in public dir
      try {
        copyFileSync(BGM_PATH, bgmDest);
      } catch {
        // Already exists from initial bundle
      }

      const outputPath = join(tmpDir, "output.mp4");

      const inputProps = {
        petName: options.petName,
        memorialText: options.memorialText || "",
        letterText: options.letterText,
        narrationDurationS: options.narrationDurationS,
        narrationSrc: "narration.mp3",
        bgMusicSrc: "bgm-piano-reflections.mp3",
      };

      console.log("[video] Selecting composition...");
      const composition = await selectComposition({
        serveUrl: bundlePath,
        id: "LetterFromHeaven",
        inputProps,
      });

      console.log(
        `[video] Rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)...`,
      );

      await renderMedia({
        composition,
        serveUrl: bundlePath,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
      });

      console.log("[video] Render complete, reading output...");
      const { readFileSync } = await import("node:fs");
      const videoBuffer = readFileSync(outputPath);

      return videoBuffer;
    } finally {
      // Clean up temp dir and per-render assets
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      try {
        rmSync(portraitPath, { force: true });
      } catch {
        // ignore
      }
      try {
        rmSync(narrationPath, { force: true });
      } catch {
        // ignore
      }
    }
  });
}

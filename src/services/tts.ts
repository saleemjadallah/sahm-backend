import textToSpeech from "@google-cloud/text-to-speech";
import { env } from "../config/env.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

// -- Lazy TTS client --

let ttsClient: textToSpeech.TextToSpeechClient | null = null;

export function isTtsConfigured(): boolean {
  return Boolean(env.GOOGLE_CREDENTIALS_JSON);
}

function getClient(): textToSpeech.TextToSpeechClient {
  if (ttsClient) return ttsClient;

  const decoded = Buffer.from(env.GOOGLE_CREDENTIALS_JSON, "base64").toString(
    "utf-8",
  );
  const credentials = JSON.parse(decoded);

  ttsClient = new textToSpeech.TextToSpeechClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });

  return ttsClient;
}

// -- Voice mapping by pet gender --

const VOICES = {
  MALE: "en-US-Studio-Q",
  FEMALE: "en-US-Studio-O",
} as const;

function selectVoice(gender: "MALE" | "FEMALE" | null | undefined): string {
  return gender && gender in VOICES ? VOICES[gender] : VOICES.FEMALE;
}

// -- Audio duration detection via ffprobe --

function getAudioDurationSeconds(mp3Buffer: Buffer): number {
  const tmpPath = join(tmpdir(), `sahm-tts-${randomUUID()}.mp3`);
  try {
    writeFileSync(tmpPath, mp3Buffer);
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tmpPath}"`,
      { encoding: "utf-8", timeout: 10_000 },
    ).trim();
    const duration = parseFloat(output);
    if (isNaN(duration)) {
      // Fallback: estimate from file size (~64kbps at 0.88x speed)
      return (mp3Buffer.length * 8) / 64_000;
    }
    return duration;
  } catch {
    // Fallback estimate
    return (mp3Buffer.length * 8) / 64_000;
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

// -- Main export --

export async function generateNarration(
  text: string,
  gender: "MALE" | "FEMALE" | null | undefined,
): Promise<{ audioBuffer: Buffer; durationSeconds: number }> {
  const client = getClient();
  const voiceName = selectVoice(gender);

  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode: "en-US",
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 0.88,
      pitch: -1.0,
      effectsProfileId: ["headphone-class-device"],
    },
  });

  const audioBuffer = Buffer.from(
    response.audioContent as Uint8Array,
  );
  const durationSeconds = getAudioDurationSeconds(audioBuffer);

  return { audioBuffer, durationSeconds };
}

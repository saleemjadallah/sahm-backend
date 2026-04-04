import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { createLetterPdf } from "../lib/letter-pdf.js";
import { prisma } from "../lib/prisma.js";
import { getObjectBuffer, uploadBuffer } from "../lib/storage.js";

const gemini = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : null;

function buildLetterPrompt(input: {
  petName: string;
  petType: string;
  breed?: string | null;
  ownerName?: string | null;
  personalityTraits?: string[];
  funnyHabits?: string | null;
  favoriteThings?: string | null;
  specialMemory?: string | null;
  description?: string | null;
}): string {
  const ownerAddress = input.ownerName?.trim() || "my dear human";
  const traitsLine = input.personalityTraits?.length
    ? `My personality: ${input.personalityTraits.join(", ")}.`
    : "";
  const habitsLine = input.funnyHabits?.trim()
    ? `Funny habits I had: ${input.funnyHabits.trim()}`
    : "";
  const favoritesLine = input.favoriteThings?.trim()
    ? `Things I loved: ${input.favoriteThings.trim()}`
    : "";
  const memoryLine = input.specialMemory?.trim()
    ? `A memory that matters: ${input.specialMemory.trim()}`
    : "";
  const descLine = input.description?.trim()
    ? `How I looked: ${input.description.trim()}`
    : "";
  const breedLine = input.breed
    ? `I was a ${input.breed} ${input.petType.toLowerCase()}.`
    : `I was a ${input.petType.toLowerCase()}.`;

  return `Write a first-person letter from a beloved pet named ${input.petName} who has crossed the rainbow bridge, addressed to their owner.

ABOUT ME:
My name is ${input.petName}. ${breedLine}
${traitsLine}
${habitsLine}
${favoritesLine}
${memoryLine}
${descLine}

WRITING GUIDELINES:
- Address the letter to "${ownerAddress}" (use this exact name/phrase).
- Write in first person as ${input.petName}. I am speaking from a peaceful, happy place.
- Length: 400-600 words. This should feel like a complete, satisfying letter — not too short, not rambling.
- Tone: warm, loving, gently humorous where the pet's personality allows. NOT melodramatic, NOT saccharine, NOT generic greeting-card language.
- Reference at least 2-3 specific details from the personality/habits/favorites/memory data above. These specific callbacks are what make the letter feel real and personal.
- Include one moment of gentle humor tied to a real habit or personality trait.
- Reassure the owner: I am at peace, I am not in pain, I am grateful for our life together.
- End with a forward-looking note of comfort — not "goodbye forever" but "I am still with you."
- Do NOT use cliches like "rainbow bridge" repeatedly, "fur baby", or "hooman". One rainbow bridge reference is fine as a setting detail.
- Do NOT include a subject line, header, or "From:" line. Just the letter body starting with the greeting.
- Sign off simply with the pet's name.

FORMAT:
Return ONLY the letter text. No markdown, no headers, no metadata.`;
}

async function generateLetterText(prompt: string): Promise<string> {
  if (!gemini) {
    // Demo fallback
    return `Dear my dear human,\n\nI'm here, in a place that feels like the warmest sunbeam you ever saw. I want you to know I'm okay. More than okay, actually.\n\nRemember all those moments? I do. Every single one.\n\nI'm still with you — always.\n\nWith all my love.`;
  }

  const response = await gemini.models.generateContent({
    model: env.GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.85,
      maxOutputTokens: 1500,
    },
  });

  const text = response.text;
  if (!text?.trim()) {
    throw new Error("Gemini did not return letter text.");
  }

  return text.trim();
}

/** Generate a "Letter From Heaven" for the given order add-on. */
export async function generateLetter(orderId: string, addOnId: string) {
  const addOn = await prisma.orderAddOn.findUniqueOrThrow({
    where: { id: addOnId },
    include: {
      order: {
        include: {
          pet: true,
          portraits: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  const { pet, portraits } = addOn.order;

  // Build and execute the letter prompt
  const prompt = buildLetterPrompt({
    petName: pet.name,
    petType: pet.type,
    breed: pet.breed,
    ownerName: pet.ownerName,
    personalityTraits: pet.personalityTraits,
    funnyHabits: pet.funnyHabits,
    favoriteThings: pet.favoriteThings,
    specialMemory: pet.specialMemory,
    description: pet.description,
  });

  let letterText = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      letterText = await generateLetterText(prompt);
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  // Find a completed portrait image for the PDF header
  let portraitImageBuffer: Buffer | null = null;
  const headerPortrait = portraits.find(
    (p) => p.status === "COMPLETED" && p.selected && p.previewKey,
  );
  if (headerPortrait?.previewKey) {
    try {
      portraitImageBuffer = await getObjectBuffer(headerPortrait.previewKey);
    } catch {
      // Proceed without header image
    }
  }

  // Create the typeset PDF
  const pdfBuffer = await createLetterPdf({
    petName: pet.name,
    letterText,
    portraitImageBuffer,
    memorialText: addOn.order.petMemorialText,
  });

  // Upload PDF to R2
  const pdfKey = `addons/${orderId}/${addOnId}/letter.pdf`;
  const uploaded = await uploadBuffer(pdfKey, pdfBuffer, "application/pdf");

  // -- Generate video memorial (TTS + Remotion) --
  // Non-fatal: if video fails, the PDF is still delivered
  let videoUrl: string | null = null;
  let videoKey: string | null = null;

  try {
    const { isTtsConfigured, generateNarration } = await import("./tts.js");

    if (isTtsConfigured()) {
      console.log(`[letter] Generating TTS narration for order ${orderId}...`);
      const { audioBuffer: narrationBuffer, durationSeconds: narrationDurationS } =
        await generateNarration(letterText, pet.gender);
      console.log(`[letter] Narration: ${narrationDurationS.toFixed(1)}s`);

      console.log(`[letter] Rendering video for order ${orderId}...`);
      const { renderLetterVideo } = await import("./video-generation.js");
      const videoBuffer = await renderLetterVideo({
        letterText,
        petName: pet.name,
        memorialText: addOn.order.petMemorialText,
        portraitImageBuffer: portraitImageBuffer!,
        narrationBuffer,
        narrationDurationS,
      });

      const vKey = `addons/${orderId}/${addOnId}/letter-video.mp4`;
      const videoUploaded = await uploadBuffer(vKey, videoBuffer, "video/mp4");
      videoUrl = videoUploaded.url;
      videoKey = videoUploaded.key;
      console.log(`[letter] Video uploaded for order ${orderId}`);
    }
  } catch (error) {
    console.error(`[letter] Video generation failed for order ${orderId}:`, error);
    // Continue — PDF is the primary deliverable
  }

  // Update the add-on record
  await prisma.orderAddOn.update({
    where: { id: addOnId },
    data: {
      status: "COMPLETED",
      generatedText: letterText,
      documentUrl: uploaded.url,
      documentKey: uploaded.key,
      videoUrl,
      videoKey,
    },
  });
}

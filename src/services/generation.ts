import { GoogleGenAI } from "@google/genai";
import {
  OrderStatus,
  PackageType,
  PortraitStatus,
  PortraitStyle,
  type Portrait,
} from "@prisma/client";
import sharp from "sharp";
import { env } from "../config/env.js";
import { PREVIEW_STYLES, STYLE_DEFINITIONS } from "../lib/catalog.js";
import { calculateFailedOrderRefund } from "../lib/order-pricing.js";
import { prisma } from "../lib/prisma.js";
import { createPrintGuidePdf } from "../lib/print-guide.js";
import { Semaphore } from "../lib/semaphore.js";
import { getObjectBuffer, uploadBuffer } from "../lib/storage.js";
import { stripe } from "../lib/stripe.js";
import {
  sendGiftNotificationEmail,
  sendGiftSentConfirmationEmail,
  sendOrderConfirmationEmail,
  sendPortraitsReadyEmail,
} from "./email.js";

type ReferencePhoto = {
  mimeType: string;
  buffer: Buffer;
};

const gemini = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;
const semaphore = new Semaphore(env.GEMINI_MAX_CONCURRENT);

const previewModel = env.GEMINI_PREVIEW_MODEL || env.GEMINI_IMAGE_MODEL;

const ANATOMICAL_FIDELITY = [
  "CRITICAL — Anatomical fidelity must override stylistic conventions:",
  "Study the uploaded reference photos before generating. The pet's exact ear position (erect, semi-erect, floppy, rose-shaped), ear shape, face shape, muzzle length, body proportions, coat texture, and markings MUST be faithfully reproduced.",
  "Do NOT default to breed stereotypes or art-style conventions for anatomy. If the reference photos show upright ears, the portrait must show upright ears regardless of what is typical for classical paintings of dogs.",
  "The reference photos are the single source of truth for the pet's physical appearance. Artistic style applies to rendering technique (brushwork, color, texture, lighting) — never to the pet's anatomy.",
];

const SHARED_PROMPT_GUARDRAILS = [
  "Capture warmth and dignity appropriate for a memorial portrait, not a novelty image.",
  "Render a finished artwork that feels premium, frame-worthy, and emotionally appropriate for a sympathy gift.",
  "Keep the subject singular and clear with no extra pets, no extra humans, and no duplicate limbs or facial features.",
  "Output a square fine-art composition that will still reproduce beautifully when centered on a 16x20 print canvas.",
];

function buildPrompt(
  portrait: Portrait,
  input: {
    petName: string;
    type: string;
    breed?: string | null;
    description?: string | null;
    memorialText?: string | null;
  },
) {
  const style = STYLE_DEFINITIONS[portrait.style];
  const breedLabel = input.breed ? `${input.breed} ` : "";
  const details = input.description?.trim();
  const memorialText = input.memorialText?.trim();

  const isYoungAgain = portrait.style === PortraitStyle.YOUNG_AGAIN;
  const subjectLine = isYoungAgain
    ? `Reimagine ${input.petName}, a ${breedLabel}${input.type.toLowerCase()}, as a very young puppy/kitten (8-12 weeks old). Preserve every unique marking, pattern, and color from the reference photos — this must be recognizably the same individual animal, just at the very beginning of their life.`
    : `Create a ${style.label} memorial portrait of ${input.petName}, a ${breedLabel}${input.type.toLowerCase()}.`;

  const sections = [
    "Role:",
    `You are a world-class pet memorial portrait artist specializing in ${style.label} artwork for bereaved pet families.`,
    "",
    "Subject:",
    subjectLine,
    details ? `Key identity details to preserve: ${details}.` : "",
    "",
    "Anatomical Fidelity (HIGHEST PRIORITY):",
    ...ANATOMICAL_FIDELITY.map((line) => `- ${line}`),
    "",
    "Style Direction:",
    style.guidance,
    `Emotional tone: ${style.emotionalTone}.`,
    `Composition: ${style.composition}.`,
    `Background: ${style.background}.`,
    `Lighting: ${style.lighting}.`,
    "",
    "Memorial Typography:",
    memorialText
      ? `Use the memorial text "${memorialText}" only if it can be integrated elegantly. ${style.textTreatment}.`
      : "Do not add any text unless the composition genuinely benefits from a subtle memorial inscription.",
    "",
    "Quality Guardrails:",
    ...SHARED_PROMPT_GUARDRAILS.map((line) => `- ${line}`),
    `- ${style.negativeGuidance}.`,
    "",
    "Output:",
    "High-resolution fine-art image, square aspect ratio, clean finishing detail, suitable for digital delivery and print preparation.",
  ];

  return sections.filter(Boolean).join("\n");
}

function hexToRgb(hex: string) {
  const safe = hex.replace("#", "");
  return {
    r: Number.parseInt(safe.slice(0, 2), 16),
    g: Number.parseInt(safe.slice(2, 4), 16),
    b: Number.parseInt(safe.slice(4, 6), 16),
  };
}

async function createDemoPortrait(petName: string, style: PortraitStyle) {
  const definition = STYLE_DEFINITIONS[style];
  const [start, middle, end] = definition.palette.map(hexToRgb);
  const overlay = `
    <svg width="1600" height="1600" viewBox="0 0 1600 1600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${definition.palette[0]}"/>
          <stop offset="55%" stop-color="${definition.palette[1]}"/>
          <stop offset="100%" stop-color="${definition.palette[2]}"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="1600" rx="120" fill="url(#bg)"/>
      <circle cx="800" cy="660" r="320" fill="rgba(255,255,255,0.22)"/>
      <ellipse cx="650" cy="560" rx="80" ry="160" fill="rgba(61,61,61,0.14)"/>
      <ellipse cx="950" cy="560" rx="80" ry="160" fill="rgba(61,61,61,0.14)"/>
      <ellipse cx="800" cy="800" rx="260" ry="220" fill="rgba(255,255,255,0.38)"/>
      <circle cx="710" cy="760" r="22" fill="#3d3d3d"/>
      <circle cx="890" cy="760" r="22" fill="#3d3d3d"/>
      <path d="M760 880 Q800 920 840 880" stroke="#3d3d3d" stroke-width="14" fill="none" stroke-linecap="round"/>
      <text x="800" y="1280" text-anchor="middle" font-size="120" font-family="Georgia, serif" fill="#ffffff">${escapeXml(
        petName,
      )}</text>
      <text x="800" y="1385" text-anchor="middle" font-size="58" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.92)">${escapeXml(
        definition.label,
      )}</text>
    </svg>
  `;

  return sharp({
    create: {
      width: 1600,
      height: 1600,
      channels: 3,
      background: {
        r: start.r,
        g: middle.g,
        b: end.b,
      },
    },
  })
    .composite([{ input: Buffer.from(overlay) }])
    .png()
    .toBuffer();
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function generateViaGemini(prompt: string, references: ReferencePhoto[], model?: string) {
  if (!gemini) {
    throw new Error("Gemini is not configured.");
  }

  const input = [
    { type: "text" as const, text: prompt },
    ...references.map((reference) => ({
      type: "image" as const,
      data: reference.buffer.toString("base64"),
      mime_type: reference.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/heic" | "image/heif",
    })),
  ];

  const interaction = (await Promise.race([
    gemini.interactions.create({
      model: model ?? env.GEMINI_IMAGE_MODEL,
      input,
      response_modalities: ["image"],
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini request timed out.")), 120_000);
    }),
  ])) as { outputs?: Array<{ type?: string; data?: string }> };

  const imageOutput = (interaction.outputs ?? []).find((output) => output.type === "image" && typeof output.data === "string");

  if (!imageOutput?.data) {
    throw new Error("Gemini did not return an image.");
  }

  return Buffer.from(imageOutput.data, "base64");
}

/* ── Asset rendering ─────────────────────────────────────── */

async function renderPreviewOnly(source: Buffer) {
  const resized = await sharp(source)
    .rotate()
    .resize(600, 600, { fit: "inside" })
    .png()
    .toBuffer();

  const watermark = `
    <svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="510" width="600" height="90" fill="rgba(61,61,61,0.46)"/>
      <text x="300" y="560" text-anchor="middle" font-size="26" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.96)">Preview</text>
    </svg>
  `;

  return sharp(resized)
    .composite([{ input: Buffer.from(watermark) }])
    .png()
    .toBuffer();
}

async function renderPortraitAssets(source: Buffer) {
  const full = await sharp(source)
    .rotate()
    .resize(4096, 4096, { fit: "inside" })
    .png()
    .toBuffer();

  const previewBase = await sharp(full)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const previewWatermark = `
    <svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="1020" width="1200" height="180" fill="rgba(61,61,61,0.46)"/>
      <text x="600" y="1110" text-anchor="middle" font-size="54" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.96)">Preview • Unlock high-resolution download</text>
    </svg>
  `;

  const preview = await sharp(previewBase)
    .composite([{ input: Buffer.from(previewWatermark) }])
    .png()
    .toBuffer();

  const printReady = await sharp(full)
    .resize(4800, 6000, {
      fit: "contain",
      background: "#f9f5f0",
    })
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();

  return { preview, full, printReady };
}

async function uploadPortraitAssets(orderId: string, portraitId: string, buffers: Awaited<ReturnType<typeof renderPortraitAssets>>) {
  const previewKey = `portraits/${orderId}/${portraitId}/preview.png`;
  const fullKey = `portraits/${orderId}/${portraitId}/full.png`;
  const printReadyKey = `portraits/${orderId}/${portraitId}/print.png`;

  const [preview, full, printReady] = await Promise.all([
    uploadBuffer(previewKey, buffers.preview, "image/png"),
    uploadBuffer(fullKey, buffers.full, "image/png"),
    uploadBuffer(printReadyKey, buffers.printReady, "image/png"),
  ]);

  return { preview, full, printReady };
}

/* ── Portrait generators ─────────────────────────────────── */

async function loadReferences(petPhotos: Array<{ processedKey: string | null; originalKey: string }>) {
  const references: ReferencePhoto[] = [];
  for (const photo of petPhotos) {
    const image = await getObjectBuffer(photo.processedKey ?? photo.originalKey).catch(() => null);
    if (image) {
      references.push({ buffer: image, mimeType: "image/png" });
    }
  }
  return references;
}

/** Generate a portrait at preview quality (cheap model, 600px, preview-only asset). */
async function generatePreviewPortrait(orderId: string, portraitId: string) {
  const portrait = await prisma.portrait.findUniqueOrThrow({
    where: { id: portraitId },
    include: {
      order: {
        include: {
          user: true,
          pet: { include: { photos: true } },
        },
      },
    },
  });

  const prompt = buildPrompt(portrait, {
    petName: portrait.order.petName,
    type: portrait.order.pet.type,
    breed: portrait.order.pet.breed,
    description: portrait.order.pet.description,
    memorialText: portrait.order.petMemorialText,
  });

  await prisma.portrait.update({
    where: { id: portraitId },
    data: { status: PortraitStatus.GENERATING, resolvedPrompt: prompt },
  });

  const references = await loadReferences(portrait.order.pet.photos);

  let output: Buffer | null = null;
  let failureReason = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (gemini) {
        output = await generateViaGemini(
          attempt === 0
            ? prompt
            : `${prompt}\n\nRETRY NOTE: The previous attempt did not match the reference photos closely enough. Pay extra attention to the pet's exact ear position, ear shape, face structure, and markings. The reference photos are the authority — do not let artistic style override anatomy.`,
          references,
          previewModel,
        );
      } else if (env.ENABLE_DEMO_GENERATION) {
        output = await createDemoPortrait(portrait.order.petName, portrait.style);
      } else {
        throw new Error("Gemini is not configured and demo generation is disabled.");
      }
      break;
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "Unknown portrait generation failure.";
      await prisma.portrait.update({
        where: { id: portraitId },
        data: { retryCount: attempt + 1, failureReason },
      });
    }
  }

  if (!output) {
    await prisma.portrait.update({
      where: { id: portraitId },
      data: { status: PortraitStatus.FAILED, failureReason },
    });
    return;
  }

  // Only render the small preview — no full or print-ready assets
  const previewBuffer = await renderPreviewOnly(output);
  const previewKey = `portraits/${orderId}/${portraitId}/preview.png`;
  const uploaded = await uploadBuffer(previewKey, previewBuffer, "image/png");

  await prisma.portrait.update({
    where: { id: portraitId },
    data: {
      status: PortraitStatus.COMPLETED,
      previewUrl: uploaded.url,
      previewKey: uploaded.key,
      failureReason: null,
    },
  });
}

/** Generate a portrait at full quality (full model, all 3 asset variants). */
async function generateFullQualityPortrait(orderId: string, portraitId: string) {
  const portrait = await prisma.portrait.findUniqueOrThrow({
    where: { id: portraitId },
    include: {
      order: {
        include: {
          user: true,
          pet: { include: { photos: true } },
        },
      },
    },
  });

  const prompt = buildPrompt(portrait, {
    petName: portrait.order.petName,
    type: portrait.order.pet.type,
    breed: portrait.order.pet.breed,
    description: portrait.order.pet.description,
    memorialText: portrait.order.petMemorialText,
  });

  await prisma.portrait.update({
    where: { id: portraitId },
    data: {
      status: PortraitStatus.GENERATING,
      resolvedPrompt: prompt,
      retryCount: 0,
      failureReason: null,
    },
  });

  const references = await loadReferences(portrait.order.pet.photos);

  let output: Buffer | null = null;
  let failureReason = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (gemini) {
        output = await generateViaGemini(
          attempt === 0
            ? prompt
            : `${prompt}\n\nRETRY NOTE: The previous attempt did not match the reference photos closely enough. Pay extra attention to the pet's exact ear position, ear shape, face structure, and markings. The reference photos are the authority — do not let artistic style override anatomy.`,
          references,
        );
      } else if (env.ENABLE_DEMO_GENERATION) {
        output = await createDemoPortrait(portrait.order.petName, portrait.style);
      } else {
        throw new Error("Gemini is not configured and demo generation is disabled.");
      }
      break;
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "Unknown portrait generation failure.";
      await prisma.portrait.update({
        where: { id: portraitId },
        data: { retryCount: attempt + 1, failureReason },
      });
    }
  }

  if (!output) {
    await prisma.portrait.update({
      where: { id: portraitId },
      data: { status: PortraitStatus.FAILED, failureReason },
    });
    return;
  }

  const buffers = await renderPortraitAssets(output);
  const uploaded = await uploadPortraitAssets(orderId, portraitId, buffers);

  await prisma.portrait.update({
    where: { id: portraitId },
    data: {
      status: PortraitStatus.COMPLETED,
      previewUrl: uploaded.preview.url,
      previewKey: uploaded.preview.key,
      fullUrl: uploaded.full.url,
      fullKey: uploaded.full.key,
      printReadyUrl: uploaded.printReady.url,
      printReadyKey: uploaded.printReady.key,
      failureReason: null,
    },
  });
}

/* ── Order-level generation orchestration ────────────────── */

async function applyRefund(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { portraits: true, addOns: true },
  });

  if (!order || !stripe || !order.stripePaymentId) {
    return;
  }

  const refundAmount = calculateFailedOrderRefund({
    amount: order.amount,
    portraits: order.portraits,
    addOns: order.addOns,
  });

  if (refundAmount <= 0) {
    return;
  }

  await stripe.refunds.create({
    payment_intent: order.stripePaymentId,
    amount: Math.min(refundAmount, order.amount),
  });
}

/**
 * Start generation for a new order.
 * - Preview flow: only generates the 3 preview styles (cheap model, low-res).
 * - Legacy flow: generates all portraits at full quality.
 */
export async function startOrderGeneration(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      pet: { include: { photos: true } },
      portraits: true,
    },
  });

  if (!order) {
    return;
  }

  const isPreviewFlow = order.status === OrderStatus.PREVIEW;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: isPreviewFlow ? OrderStatus.PREVIEW : OrderStatus.GENERATING },
  });

  if (isPreviewFlow) {
    // Only generate the 3 preview styles with the cheap model
    const previewStyleSet = new Set<string>(PREVIEW_STYLES);
    const previewPortraits = order.portraits.filter((p) => previewStyleSet.has(p.style));

    await Promise.all(
      previewPortraits.map((portrait) =>
        semaphore.use(() => generatePreviewPortrait(orderId, portrait.id)),
      ),
    );

    const completedCount = (
      await prisma.portrait.findMany({
        where: { orderId, style: { in: PREVIEW_STYLES } },
      })
    ).filter((p) => p.status === PortraitStatus.COMPLETED).length;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: completedCount > 0 ? OrderStatus.PREVIEWS_READY : OrderStatus.FAILED,
      },
    });
    return;
  }

  // Legacy flow: generate all portraits at full quality
  await Promise.all(
    order.portraits.map((portrait) =>
      semaphore.use(() => generateFullQualityPortrait(orderId, portrait.id)),
    ),
  );

  const refreshed = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, portraits: true },
  });

  const completedCount = refreshed.portraits.filter(
    (portrait) => portrait.status === PortraitStatus.COMPLETED,
  ).length;

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: completedCount > 0 ? OrderStatus.COMPLETED : OrderStatus.FAILED,
    },
    include: { user: true, portraits: true },
  });

  await applyRefund(orderId);

  if (completedCount > 0 && updatedOrder.stripePaymentId) {
    await sendPortraitsReadyEmail(updatedOrder.user, updatedOrder, updatedOrder.portraits);
    if (updatedOrder.isGift && updatedOrder.giftToken) {
      await sendGiftNotificationEmail(updatedOrder, updatedOrder.user.name ?? updatedOrder.user.email, updatedOrder.portraits);
      await sendGiftSentConfirmationEmail(updatedOrder.user, updatedOrder);
    }
  }
}

/**
 * After payment: generate full-quality assets for all selected portraits.
 * Re-generates preview portraits at full quality; generates locked ones from scratch.
 */
export async function startPostPaymentGeneration(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      pet: { include: { photos: true } },
      portraits: true,
    },
  });

  if (!order) return;

  const selectedPortraits = order.portraits.filter((p) => p.selected);
  if (selectedPortraits.length === 0) return;

  // Reset selected portraits to PENDING so they re-generate at full quality
  await prisma.portrait.updateMany({
    where: {
      id: { in: selectedPortraits.map((p) => p.id) },
    },
    data: {
      status: PortraitStatus.PENDING,
      fullUrl: null,
      fullKey: null,
      printReadyUrl: null,
      printReadyKey: null,
      retryCount: 0,
      failureReason: null,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.GENERATING },
  });

  await Promise.all(
    selectedPortraits.map((portrait) =>
      semaphore.use(() => generateFullQualityPortrait(orderId, portrait.id)),
    ),
  );

  // Generate add-ons after portraits complete (letter needs a portrait for header)
  await generateOrderAddOns(orderId);

  const refreshed = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, portraits: true, addOns: true },
  });

  const completedSelected = refreshed.portraits
    .filter((p) => p.selected)
    .filter((p) => p.status === PortraitStatus.COMPLETED).length;

  const allAddOnsDone = refreshed.addOns.every(
    (a) => a.status === "COMPLETED" || a.status === "FAILED",
  );

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: completedSelected > 0 && allAddOnsDone ? OrderStatus.COMPLETED : OrderStatus.FAILED,
    },
    include: { user: true, portraits: true },
  });

  await applyRefund(orderId);

  if (completedSelected > 0) {
    await sendPortraitsReadyEmail(updatedOrder.user, updatedOrder, updatedOrder.portraits);
    if (updatedOrder.isGift && updatedOrder.giftToken) {
      await sendGiftNotificationEmail(updatedOrder, updatedOrder.user.name ?? updatedOrder.user.email, updatedOrder.portraits);
      await sendGiftSentConfirmationEmail(updatedOrder.user, updatedOrder);
    }
  }
}

/**
 * Generate all pending add-ons (Letter From Heaven, Storybook) for an order.
 * Called after portraits finish so letter can use a portrait as header.
 */
async function generateOrderAddOns(orderId: string) {
  const addOns = await prisma.orderAddOn.findMany({
    where: { orderId, status: "PENDING" },
  });

  for (const addOn of addOns) {
    try {
      await prisma.orderAddOn.update({
        where: { id: addOn.id },
        data: { status: "GENERATING" },
      });

      if (addOn.type === "LETTER_FROM_HEAVEN") {
        const { generateLetter } = await import("./letter-generation.js");
        await generateLetter(orderId, addOn.id);
      } else if (addOn.type === "STORYBOOK") {
        const { generateStorybook } = await import("./storybook-generation.js");
        await generateStorybook(orderId, addOn.id);
      }
    } catch (error) {
      await prisma.orderAddOn.update({
        where: { id: addOn.id },
        data: {
          status: "FAILED",
          failureReason: error instanceof Error ? error.message : "Unknown failure",
        },
      });
    }
  }
}

export async function handlePaidOrder(orderId: string, stripePaymentId?: string | null, stripeSessionId?: string | null) {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      portraits: true,
    },
  });

  if (!existingOrder || existingOrder.stripePaymentId) {
    return;
  }

  if (existingOrder.promoCode) {
    await prisma.promoCode.update({
      where: { code: existingOrder.promoCode },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }

  // For CUSTOM orders: mark as PAID then kick off full-quality generation
  const isCustomFlow = existingOrder.packageType === PackageType.CUSTOM;

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PAID,
      stripePaymentId: stripePaymentId ?? undefined,
      stripeSessionId: stripeSessionId ?? undefined,
    },
    include: {
      user: true,
      portraits: true,
    },
  });

  if (isCustomFlow) {
    // Trigger full-quality generation async — user will see progress on order page
    await sendOrderConfirmationEmail(order.user, order);
    setTimeout(() => {
      void startPostPaymentGeneration(orderId);
    }, 0);
    return;
  }

  // Legacy flow
  const hasFinishedPortraits = order.portraits.some((portrait) => portrait.status === PortraitStatus.COMPLETED);
  const hasPendingGeneration = order.portraits.some(
    (portrait) => portrait.status === PortraitStatus.PENDING || portrait.status === PortraitStatus.GENERATING,
  );

  if (hasFinishedPortraits && !hasPendingGeneration) {
    await sendPortraitsReadyEmail(order.user, order, order.portraits);
    if (order.isGift && order.giftToken) {
      await sendGiftNotificationEmail(order, order.user.name ?? order.user.email, order.portraits);
      await sendGiftSentConfirmationEmail(order.user, order);
    }
    return;
  }

  await sendOrderConfirmationEmail(order.user, order);
}

export function getPackagePortraitCount(packageType: PackageType) {
  switch (packageType) {
    case PackageType.SINGLE:
      return 1;
    case PackageType.MEMORIAL:
      return 5;
    case PackageType.PREMIUM:
    case PackageType.CUSTOM:
      return 10;
  }
}

export function createPrintGuideBuffer(petName: string) {
  return createPrintGuidePdf(petName);
}

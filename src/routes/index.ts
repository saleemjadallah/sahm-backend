import type { FastifyInstance, FastifyRequest } from "fastify";
import archiver from "archiver";
import { AddOnType as PrismaAddOnType, DiscountType, OrderStatus, PackageType, PetType, PortraitStyle } from "@prisma/client";
import sharp from "sharp";
import Stripe from "stripe";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import {
  getPackageStyles, PACKAGE_PRICING, ALL_STYLES,
  ADDON_PORTRAIT_STYLES, ADDON_CATALOG, ADDON_PORTRAIT_PRICE_CENTS,
  getUnitPrice,
  type AddOnType,
} from "../lib/catalog.js";
import { getSelectedOrderPricing } from "../lib/order-pricing.js";
import {
  getVariant, getRetailPrice, requiresFrame, getPrintProductList,
  type PrintProductType, type PrintSize,
} from "../lib/printful-catalog.js";
import { prisma } from "../lib/prisma.js";
import { createPrintGuidePdf } from "../lib/print-guide.js";
import { getObjectBuffer, uploadBuffer, deleteObject } from "../lib/storage.js";
import { verifyPrintfulWebhookSignature } from "../lib/printful-webhook.js";
import { stripe } from "../lib/stripe.js";
import { customOrderNeedsPostPaymentFulfillment, handlePaidOrder, startPostPaymentGeneration } from "../services/generation.js";
import { isPrintfulConfigured, estimateShipping } from "../services/printful.js";
import { submitPaidPrintOrder } from "../services/printful-orders.js";

function requireUser(request: FastifyRequest) {
  if (!request.authUser) {
    const error = new Error("Authentication required.");
    // @ts-expect-error Fastify error status hint
    error.statusCode = 401;
    throw error;
  }

  return request.authUser;
}

function createError(statusCode: number, message: string) {
  const error = new Error(message);
  // @ts-expect-error Fastify-style status hint
  error.statusCode = statusCode;
  return error;
}

function createGiftToken() {
  return randomBytes(24).toString("hex");
}

function getPriceIdForPackage(packageType: PackageType) {
  if (packageType === PackageType.CUSTOM) return null;
  if (packageType === PackageType.SINGLE) return env.STRIPE_PRICE_SINGLE;
  if (packageType === PackageType.MEMORIAL) return env.STRIPE_PRICE_MEMORIAL;
  return env.STRIPE_PRICE_PREMIUM;
}

async function getPromoDiscount(code: string | undefined, amount: number) {
  if (!code) {
    return { discountAmount: 0, promoCode: null as string | null };
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!promo || !promo.isActive || (promo.expiresAt && promo.expiresAt < new Date())) {
    return { discountAmount: 0, promoCode: null as string | null };
  }

  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    return { discountAmount: 0, promoCode: null as string | null };
  }

  const discountAmount =
    promo.type === DiscountType.PERCENT
      ? Math.round((amount * promo.value) / 100)
      : Math.min(amount, promo.value);

  return { discountAmount, promoCode: promo.code };
}

function normalizeFilename(input: string | undefined, fallback: string) {
  return (input ?? fallback).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

function orderHasPaidStatus(status: OrderStatus) {
  return status === OrderStatus.PAID || status === OrderStatus.GENERATING || status === OrderStatus.COMPLETED;
}

function orderIsPaid(order: { stripePaymentId: string | null; status: OrderStatus }) {
  return Boolean(order.stripePaymentId) || orderHasPaidStatus(order.status);
}

function serializeOrder<T extends {
  stripePaymentId: string | null;
  status: OrderStatus;
  packageType: PackageType;
  portraits: Array<{
    id: string;
    style: PortraitStyle;
    status: string;
    selected: boolean;
    previewUrl: string | null;
    fullUrl: string | null;
    printReadyUrl: string | null;
  }>;
  addOns?: Array<{
    id: string;
    type: string;
    status: string;
    priceCents: number;
    documentUrl: string | null;
    documentKey: string | null;
    previewUrl: string | null;
    previewKey: string | null;
    generatedText: string | null;
    metadata: unknown;
    failureReason: string | null;
    createdAt: Date;
  }>;
}>(order: T) {
  const isPaid = orderIsPaid(order);
  const isCustom = order.packageType === PackageType.CUSTOM;

  return {
    ...order,
    isPaid,
    portraits: order.portraits.map((portrait) => ({
      ...portrait,
      fullUrl: isPaid && (!isCustom || portrait.selected) ? portrait.fullUrl : null,
      printReadyUrl: isPaid && (!isCustom || portrait.selected) ? portrait.printReadyUrl : null,
    })),
    addOns: (order.addOns ?? []).map((addOn) => ({
      ...addOn,
      documentUrl: isPaid ? addOn.documentUrl : null,
      documentKey: isPaid ? addOn.documentKey : null,
      generatedText: isPaid ? addOn.generatedText : null,
    })),
  };
}

async function processPhotoBuffer(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 512) {
    const error = new Error("Each photo must be at least 512x512 pixels.");
    // @ts-expect-error Fastify error status hint
    error.statusCode = 400;
    throw error;
  }

  const processed = await sharp(buffer)
    .rotate()
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  return { metadata, processed };
}

function orderSelect() {
  return {
    portraits: {
      orderBy: { createdAt: "asc" as const },
    },
    addOns: {
      orderBy: { createdAt: "asc" as const },
    },
    pet: {
      include: {
        photos: {
          orderBy: { createdAt: "asc" as const },
        },
      },
    },
  };
}

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
    imageModel: env.GEMINI_IMAGE_MODEL,
  }));

  app.get("/files/*", async (request, reply) => {
    const key = (request.params as { "*": string })["*"];
    const buffer = await getObjectBuffer(key);
    const contentType = key.endsWith(".pdf")
      ? "application/pdf"
      : key.endsWith(".jpg") || key.endsWith(".jpeg")
        ? "image/jpeg"
        : key.endsWith(".webp")
          ? "image/webp"
          : "image/png";

    reply.header("Content-Type", contentType);
    return reply.send(buffer);
  });

  app.post("/api/auth/webhook", async (request) => {
    const body = request.body as {
      type?: string;
      data?: { id?: string; email_addresses?: Array<{ email_address?: string }>; first_name?: string; last_name?: string };
    };

    const clerkId = body.data?.id;
    if (!clerkId) {
      return { received: true };
    }

    if (body.type?.startsWith("user.deleted")) {
      await prisma.user.deleteMany({ where: { clerkId } });
      return { received: true };
    }

    const email = body.data?.email_addresses?.[0]?.email_address;
    const first = body.data?.first_name ?? "";
    const last = body.data?.last_name ?? "";

    if (email) {
      await prisma.user.upsert({
        where: { clerkId },
        update: {
          email,
          name: `${first} ${last}`.trim() || null,
        },
        create: {
          clerkId,
          email,
          name: `${first} ${last}`.trim() || null,
        },
      });
    }

    return { received: true };
  });

  app.get("/api/pets", async (request) => {
    const user = requireUser(request);
    return prisma.pet.findMany({
      where: { userId: user.id },
      include: { photos: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/api/pets", async (request) => {
    const user = requireUser(request);
    const body = request.body as {
      name: string;
      type?: "DOG" | "CAT" | "OTHER";
      breed?: string;
      description?: string;
      personalityTraits?: string[];
      funnyHabits?: string;
      favoriteThings?: string;
      ownerName?: string;
      specialMemory?: string;
    };

    if (!body?.name?.trim()) {
      throw new Error("Pet name is required.");
    }

    return prisma.pet.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        type: (body.type as PetType | undefined) ?? PetType.DOG,
        breed: body.breed?.trim() || null,
        description: body.description?.trim() || null,
        personalityTraits: body.personalityTraits ?? [],
        funnyHabits: body.funnyHabits?.trim() || null,
        favoriteThings: body.favoriteThings?.trim() || null,
        ownerName: body.ownerName?.trim() || null,
        specialMemory: body.specialMemory?.trim() || null,
      },
      include: { photos: true },
    });
  });

  app.get("/api/pets/:id", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };

    const pet = await prisma.pet.findFirst({
      where: { id, userId: user.id },
      include: { photos: true },
    });

    if (!pet) {
      throw createError(404, "Pet not found.");
    }

    return pet;
  });

  app.delete("/api/pets/:id", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const pet = await prisma.pet.findFirst({
      where: { id, userId: user.id },
      include: { photos: true },
    });

    if (!pet) {
      throw createError(404, "Pet not found.");
    }

    await Promise.all(
      pet.photos.flatMap((photo) => [deleteObject(photo.originalKey), deleteObject(photo.processedKey ?? "")]),
    );

    await prisma.pet.delete({ where: { id } });
    return { success: true };
  });

  app.post("/api/pets/:petId/photos", async (request) => {
    const user = requireUser(request);
    const { petId } = request.params as { petId: string };
    const pet = await prisma.pet.findFirst({
      where: { id: petId, userId: user.id },
      include: { photos: true },
    });

    if (!pet) {
      throw createError(404, "Pet not found.");
    }

    const uploads = request.files();
    const created = [];
    let index = 0;

    for await (const part of uploads) {
      if (part.type !== "file") {
        continue;
      }

      const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
      if (!allowed.includes(part.mimetype)) {
        throw createError(400, "Only JPG, PNG, HEIC, and WebP files are supported.");
      }

      const originalBuffer = await part.toBuffer();
      const { metadata, processed } = await processPhotoBuffer(originalBuffer);
      const extension = part.mimetype.includes("png") ? "png" : part.mimetype.includes("webp") ? "webp" : "jpg";
      const originalKey = `uploads/${user.id}/${petId}/${randomUUID()}-${normalizeFilename(part.filename, `photo-${index + 1}.${extension}`)}`;
      const processedKey = `processed/${user.id}/${petId}/${randomUUID()}.png`;

      const [originalUpload, processedUpload] = await Promise.all([
        uploadBuffer(originalKey, originalBuffer, part.mimetype),
        uploadBuffer(processedKey, processed, "image/png"),
      ]);

      const photo = await prisma.petPhoto.create({
        data: {
          petId,
          originalUrl: originalUpload.url,
          processedUrl: processedUpload.url,
          originalKey: originalUpload.key,
          processedKey: processedUpload.key,
          mimeType: part.mimetype,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          isPrimary: pet.photos.length === 0 && index === 0,
        },
      });

      created.push(photo);
      index += 1;
    }

    return created;
  });

  app.delete("/api/pets/:petId/photos/:photoId", async (request) => {
    const user = requireUser(request);
    const { petId, photoId } = request.params as { petId: string; photoId: string };
    const photo = await prisma.petPhoto.findFirst({
      where: {
        id: photoId,
        petId,
        pet: {
          userId: user.id,
        },
      },
    });

    if (!photo) {
      throw createError(404, "Photo not found.");
    }

    await Promise.all([deleteObject(photo.originalKey), deleteObject(photo.processedKey ?? "")]);
    await prisma.petPhoto.delete({ where: { id: photoId } });
    return { success: true };
  });

  app.post("/api/promo/validate", async (request) => {
    const body = request.body as { code?: string; packageType?: PackageType; amount?: number };
    const base = body.amount ?? PACKAGE_PRICING[body.packageType ?? PackageType.MEMORIAL]?.amount ?? 0;
    const promo = await getPromoDiscount(body.code, base);

    return {
      valid: Boolean(promo.promoCode),
      code: promo.promoCode,
      discountAmount: promo.discountAmount,
      finalAmount: Math.max(0, base - promo.discountAmount),
    };
  });

  app.get("/api/orders", async (request) => {
    const user = requireUser(request);
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: orderSelect(),
      orderBy: { createdAt: "desc" },
    });
    return orders.map((order) => serializeOrder(order));
  });

  app.post("/api/orders", async (request) => {
    const user = requireUser(request);
    const body = request.body as {
      petId: string;
      packageType: PackageType;
      selectedStyle?: PortraitStyle;
      memorialText?: string;
      sendAsGift?: boolean;
      recipientName?: string;
      recipientEmail?: string;
      personalMessage?: string;
      promoCode?: string;
    };

    const pet = await prisma.pet.findFirst({
      where: { id: body.petId, userId: user.id },
      include: { photos: true },
    });

    if (!pet) {
      throw createError(404, "Pet not found.");
    }

    if (pet.photos.length < 3) {
      throw createError(400, "Please upload at least 3 photos.");
    }

    const baseAmount = PACKAGE_PRICING[body.packageType].amount;
    const { discountAmount, promoCode } = await getPromoDiscount(body.promoCode, baseAmount);
    const amount = Math.max(0, baseAmount - discountAmount);
    const styles = getPackageStyles(body.packageType, body.selectedStyle);

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        petId: pet.id,
        packageType: body.packageType,
        amount,
        petName: pet.name,
        petMemorialText: body.memorialText?.trim() || null,
        promoCode,
        discountAmount,
        isGift: Boolean(body.sendAsGift),
        recipientName: body.sendAsGift ? body.recipientName?.trim() || null : null,
        recipientEmail: body.sendAsGift ? body.recipientEmail?.trim() || null : null,
        personalMessage: body.sendAsGift ? body.personalMessage?.trim() || null : null,
        giftToken: body.sendAsGift ? createGiftToken() : null,
        portraits: {
          create: styles.map((style) => ({
            style,
          })),
        },
      },
      include: {
        portraits: true,
      },
    });

    setTimeout(() => {
      void import("../services/generation.js").then(({ startOrderGeneration }) => startOrderGeneration(order.id));
    }, 0);

    return {
      orderId: order.id,
      checkoutUrl: null,
    };
  });

  /* ── Preview-first flow endpoints ────────────────────────── */

  app.post("/api/orders/preview", async (request) => {
    const user = requireUser(request);
    const body = request.body as { petId: string; memorialText?: string };

    const pet = await prisma.pet.findFirst({
      where: { id: body.petId, userId: user.id },
      include: { photos: true },
    });

    if (!pet) throw createError(404, "Pet not found.");
    if (pet.photos.length < 3) throw createError(400, "Please upload at least 3 photos.");

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        petId: pet.id,
        packageType: PackageType.PREMIUM,
        status: OrderStatus.PREVIEW,
        amount: 0,
        petName: pet.name,
        petMemorialText: body.memorialText?.trim() || null,
        portraits: {
          create: ALL_STYLES.map((style) => ({ style })),
        },
      },
      include: { portraits: true },
    });

    setTimeout(() => {
      void import("../services/generation.js").then(({ startOrderGeneration }) =>
        startOrderGeneration(order.id),
      );
    }, 0);

    return { orderId: order.id };
  });

  app.patch("/api/orders/:id/portraits/select", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      portraitIds: string[];
      addOnPortraitStyles?: string[];
      addOnTypes?: string[];
    };

    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { portraits: true, addOns: true },
    });

    if (!order) throw createError(404, "Order not found.");
    if (order.status !== OrderStatus.PREVIEWS_READY) {
      throw createError(400, "Portraits are not ready for selection yet.");
    }

    const validIds = new Set(order.portraits.map((p) => p.id));
    for (const pid of body.portraitIds) {
      if (!validIds.has(pid)) throw createError(400, `Portrait ${pid} does not belong to this order.`);
    }

    const selectedSet = new Set(body.portraitIds);
    await Promise.all(
      order.portraits.map((p) =>
        prisma.portrait.update({
          where: { id: p.id },
          data: { selected: selectedSet.has(p.id) },
        }),
      ),
    );

    // Handle add-on portrait styles (e.g., YOUNG_AGAIN)
    const requestedAddOnStyles = new Set(
      (body.addOnPortraitStyles ?? []).filter((s) =>
        ADDON_PORTRAIT_STYLES.includes(s as PortraitStyle),
      ),
    );
    const existingAddOnPortraits = order.portraits.filter((p) =>
      ADDON_PORTRAIT_STYLES.includes(p.style),
    );

    for (const style of requestedAddOnStyles) {
      await prisma.portrait.upsert({
        where: {
          orderId_style: {
            orderId: id,
            style: style as PortraitStyle,
          },
        },
        update: { selected: true },
        create: { orderId: id, style: style as PortraitStyle, selected: true },
      });
    }
    for (const p of existingAddOnPortraits) {
      if (!requestedAddOnStyles.has(p.style)) {
        await prisma.portrait.deleteMany({
          where: {
            orderId: id,
            style: p.style,
          },
        });
      }
    }

    // Handle document add-ons (Letter, Storybook)
    const requestedDocAddOns = new Set(
      (body.addOnTypes ?? []).filter((t) => t in ADDON_CATALOG),
    );
    const existingDocAddOns = order.addOns;

    for (const type of requestedDocAddOns) {
      await prisma.orderAddOn.upsert({
        where: {
          orderId_type: {
            orderId: id,
            type: type as PrismaAddOnType,
          },
        },
        update: {
          priceCents: ADDON_CATALOG[type as AddOnType].priceCents,
        },
        create: {
          orderId: id,
          type: type as PrismaAddOnType,
          priceCents: ADDON_CATALOG[type as AddOnType].priceCents,
        },
      });
    }
    for (const a of existingDocAddOns) {
      if (!requestedDocAddOns.has(a.type)) {
        await prisma.orderAddOn.deleteMany({
          where: {
            orderId: id,
            type: a.type,
          },
        });
      }
    }

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: orderSelect(),
    });

    return serializeOrder(updated);
  });

  app.post("/api/orders/:id/finalize", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
      promoCode?: string;
      sendAsGift?: boolean;
      recipientName?: string;
      recipientEmail?: string;
      personalMessage?: string;
    };

    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { portraits: true, addOns: true },
    });

    if (!order) throw createError(404, "Order not found.");
    if (orderIsPaid(order)) throw createError(400, "Order is already paid.");
    if (order.status !== OrderStatus.PREVIEWS_READY) {
      throw createError(400, "Order must be in preview state before finalizing.");
    }

    const selectedPortraits = order.portraits.filter((p) => p.selected);
    if (selectedPortraits.length === 0) throw createError(400, "Please select at least one portrait.");

    const pricing = getSelectedOrderPricing(order.portraits, order.addOns as Array<{
      id: string;
      type: AddOnType;
      priceCents: number;
    }>);
    const { standardCount, addOnPortraitCount, portraitSubtotal, docAddOnsTotal, subtotal, unitPrice } = pricing;
    const { discountAmount, promoCode } = await getPromoDiscount(body.promoCode, subtotal);
    const total = Math.max(0, subtotal - discountAmount);

    await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PENDING,
        packageType: PackageType.CUSTOM,
        amount: total,
        portraitCount: selectedPortraits.length,
        promoCode,
        discountAmount,
        isGift: Boolean(body.sendAsGift),
        recipientName: body.sendAsGift ? body.recipientName?.trim() || null : null,
        recipientEmail: body.sendAsGift ? body.recipientEmail?.trim() || null : null,
        personalMessage: body.sendAsGift ? body.personalMessage?.trim() || null : null,
        giftToken: body.sendAsGift ? createGiftToken() : null,
      },
    });

    return {
      orderId: id,
      portraitCount: selectedPortraits.length,
      standardCount,
      unitPrice,
      portraitSubtotal,
      addOnPortraitCount,
      addOns: order.addOns.map((a) => ({ type: a.type, priceCents: a.priceCents })),
      docAddOnsTotal,
      subtotal,
      discountAmount,
      total,
    };
  });

  app.get("/api/orders/:id", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: orderSelect(),
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    if (
      orderIsPaid(order) &&
      order.packageType === PackageType.CUSTOM &&
      order.status !== OrderStatus.GENERATING &&
      customOrderNeedsPostPaymentFulfillment(order)
    ) {
      setTimeout(() => {
        void startPostPaymentGeneration(order.id);
      }, 0);
    }

    return serializeOrder(order);
  });

  app.post("/api/orders/:id/reconcile-checkout", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as { sessionId?: string };
    const sessionId = body.sessionId?.trim();

    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        stripePaymentId: true,
        stripeSessionId: true,
      },
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    if (orderIsPaid(order)) {
      return { reconciled: true, isPaid: true };
    }

    if (!sessionId) {
      throw createError(400, "A checkout session ID is required.");
    }

    if (!stripe) {
      return { reconciled: false, isPaid: false };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.orderId !== order.id) {
      throw createError(400, "Checkout session does not belong to this order.");
    }

    if (order.stripeSessionId && order.stripeSessionId !== session.id) {
      throw createError(400, "Checkout session does not match the saved order session.");
    }

    if (session.payment_status !== "paid") {
      return { reconciled: false, isPaid: false };
    }

    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
    await handlePaidOrder(order.id, paymentIntent, session.id);

    return { reconciled: true, isPaid: true };
  });

  app.post("/api/checkout/create-session", async (request) => {
    const user = requireUser(request);
    const body = request.body as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, userId: user.id },
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    if (orderIsPaid(order)) {
      return { checkoutUrl: `${env.FRONTEND_URL}/order/${order.id}` };
    }

    if (!stripe && env.NODE_ENV !== "production") {
      await handlePaidOrder(order.id, `demo_pi_${order.id}`, `demo_cs_${order.id}`);
      return { checkoutUrl: `${env.FRONTEND_URL}/order/${order.id}` };
    }

    if (!stripe) {
      throw createError(503, "Payments are not configured.");
    }

    const priceId = getPriceIdForPackage(order.packageType);

    // Build itemized line items for CUSTOM orders
    const orderAddOns = await prisma.orderAddOn.findMany({ where: { orderId: order.id } });
    const selectedPortraits = await prisma.portrait.findMany({
      where: { orderId: order.id, selected: true },
    });
    const addOnStyleSet = new Set<string>(ADDON_PORTRAIT_STYLES);
    const standardCount = selectedPortraits.filter((p) => !addOnStyleSet.has(p.style)).length;
    const addOnPortraitCount = selectedPortraits.filter((p) => addOnStyleSet.has(p.style)).length;

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;

    if (priceId) {
      // Legacy package flow
      lineItems = [{ price: priceId, quantity: 1 }];
    } else {
      // New CUSTOM flow — itemized line items
      const productData = (name: string) => ({ name: `${name} — ${order.petName}` });
      const withProduct = (productEnv: string, name: string) =>
        productEnv ? { product: productEnv } : { product_data: productData(name) };

      lineItems = [];

      if (standardCount > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            ...withProduct(env.STRIPE_PRODUCT_PORTRAITS, "Memorial Portrait"),
            unit_amount: getUnitPrice(standardCount),
          },
          quantity: standardCount,
        });
      }

      if (addOnPortraitCount > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            ...withProduct(env.STRIPE_PRODUCT_YOUNG_AGAIN, "Young Again Portrait"),
            unit_amount: ADDON_PORTRAIT_PRICE_CENTS,
          },
          quantity: addOnPortraitCount,
        });
      }

      for (const addOn of orderAddOns) {
        const catalog = ADDON_CATALOG[addOn.type as AddOnType];
        const productEnvMap: Record<string, string> = {
          LETTER_FROM_HEAVEN: env.STRIPE_PRODUCT_LETTER,
          STORYBOOK: env.STRIPE_PRODUCT_STORYBOOK,
        };
        lineItems.push({
          price_data: {
            currency: "usd",
            ...withProduct(productEnvMap[addOn.type] ?? "", catalog.label),
            unit_amount: catalog.priceCents,
          },
          quantity: 1,
        });
      }

      // Handle promo code discount via Stripe coupon
      if (order.discountAmount && order.discountAmount > 0 && stripe) {
        const coupon = await stripe.coupons.create({
          amount_off: order.discountAmount,
          currency: "usd",
          name: order.promoCode ? `Promo: ${order.promoCode}` : "Discount",
          duration: "once",
        });
        discounts = [{ coupon: coupon.id }];
      }

      // Fallback: if no line items somehow, use single lump sum
      if (lineItems.length === 0) {
        lineItems = [{
          price_data: {
            currency: "usd",
            product_data: { name: `Memorial Portraits for ${order.petName}` },
            unit_amount: order.amount,
          },
          quantity: 1,
        }];
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.FRONTEND_URL}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/order/${order.id}`,
      customer_email: user.email,
      metadata: {
        orderId: order.id,
        userId: user.id,
      },
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return { checkoutUrl: session.url };
  });

  // Stripe webhook in its own scope — needs raw body for signature verification,
  // so we replace the JSON parser with a raw string parser in this scope only.
  app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req: FastifyRequest, body: string, done: (err: null, result: string) => void) => {
        done(null, body);
      },
    );

    scope.post("/api/webhooks/stripe", async (request, reply) => {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        return { received: true };
      }

      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        throw createError(400, "Missing Stripe signature.");
      }

      const payload = request.body as string;
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({ error: "Invalid Stripe webhook signature." });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;

        // Check if this is a print order payment
        if (session.metadata?.type === "print_order" && session.metadata?.printOrderId) {
          await submitPaidPrintOrder(session.metadata.printOrderId, paymentIntent, session.id);
        }

        // Check if this is a portrait order payment
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await handlePaidOrder(orderId, paymentIntent, session.id);
        }
      }

      return { received: true };
    });
  });

  app.get("/api/orders/:orderId/portraits", async (request) => {
    const user = requireUser(request);
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: {
        portraits: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    return serializeOrder(order).portraits;
  });

  app.get("/api/orders/:orderId/portraits/:id/download", async (request, reply) => {
    const user = requireUser(request);
    const { orderId, id } = request.params as { orderId: string; id: string };
    const variant = ((request.query as { variant?: string }).variant ?? "full").toLowerCase();
    const portrait = await prisma.portrait.findFirst({
      where: {
        id,
        orderId,
        order: {
          userId: user.id,
        },
      },
      include: {
        order: {
          select: {
            stripePaymentId: true,
            status: true,
            packageType: true,
          },
        },
      },
    });

    if (!portrait) {
      throw createError(404, "Portrait not found.");
    }

    if (!orderIsPaid(portrait.order) && variant !== "preview") {
      throw createError(402, "Payment is required to download high-resolution files.");
    }

    if (portrait.order.packageType === PackageType.CUSTOM && !portrait.selected && variant !== "preview") {
      throw createError(403, "This portrait was not included in your order.");
    }

    const url =
      variant === "preview" ? portrait.previewUrl : variant === "print" ? portrait.printReadyUrl : portrait.fullUrl;

    if (!url) {
      throw createError(400, "Requested file is not available yet.");
    }

    return reply.redirect(url);
  });

  app.get("/api/orders/:orderId/download-all", async (request, reply) => {
    const user = requireUser(request);
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: {
        portraits: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    if (!orderIsPaid(order)) {
      throw createError(402, "Payment is required to download the full bundle.");
    }

    reply.header("Content-Type", "application/zip");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${normalizeFilename(order.petName, order.petName)}-portraits.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error: Error) => {
      throw error;
    });
    archive.pipe(reply.raw);

    const isCustom = order.packageType === PackageType.CUSTOM;
    for (const portrait of order.portraits) {
      if (isCustom && !portrait.selected) continue;
      if (portrait.fullKey) {
        const full = await getObjectBuffer(portrait.fullKey);
        archive.append(full, { name: `${portrait.style.toLowerCase()}-full.png` });
      }
      if (portrait.printReadyKey) {
        const print = await getObjectBuffer(portrait.printReadyKey);
        archive.append(print, { name: `${portrait.style.toLowerCase()}-print-ready.png` });
      }
    }

    // Include add-on files in the ZIP
    const addOns = await prisma.orderAddOn.findMany({
      where: { orderId, status: "COMPLETED" },
    });
    for (const addOn of addOns) {
      if (addOn.documentKey) {
        const doc = await getObjectBuffer(addOn.documentKey);
        const name = addOn.type === "LETTER_FROM_HEAVEN" ? "letter-from-heaven.pdf" : "storybook.pdf";
        archive.append(doc, { name });
      }
    }

    archive.append(createPrintGuidePdf(order.petName), { name: "print-guide.pdf" });
    await archive.finalize();
    return reply;
  });

  // Add-on download endpoint
  app.get("/api/orders/:orderId/addons/:addOnId/download", async (request, reply) => {
    const user = requireUser(request);
    const { orderId, addOnId } = request.params as { orderId: string; addOnId: string };

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
    });

    if (!order) throw createError(404, "Order not found.");
    if (!orderIsPaid(order)) throw createError(402, "Payment is required.");

    const addOn = await prisma.orderAddOn.findFirst({
      where: { id: addOnId, orderId },
    });

    if (!addOn) throw createError(404, "Add-on not found.");
    if (addOn.status !== "COMPLETED" || !addOn.documentKey) {
      throw createError(404, "Add-on is not ready yet.");
    }

    const buffer = await getObjectBuffer(addOn.documentKey);
    const ext = addOn.documentKey.endsWith(".pdf") ? "pdf" : "png";
    const label = addOn.type === "LETTER_FROM_HEAVEN" ? "letter-from-heaven" : "storybook";

    reply.header("Content-Type", ext === "pdf" ? "application/pdf" : "image/png");
    reply.header(
      "Content-Disposition",
      `${ext === "pdf" ? "inline" : "attachment"}; filename="${normalizeFilename(order.petName, "pet")}-${label}.${ext}"`,
    );
    return reply.send(buffer);
  });

  app.get("/api/orders/:orderId/print-guide", async (request, reply) => {
    const user = requireUser(request);
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
    });

    if (!order) {
      throw createError(404, "Order not found.");
    }

    if (!orderIsPaid(order)) {
      throw createError(402, "Payment is required to download the print guide.");
    }

    const pdf = createPrintGuidePdf(order.petName);
    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${normalizeFilename(order.petName, order.petName)}-print-guide.pdf"`,
    );
    return reply.send(pdf);
  });

  app.get("/api/gift/:token", async (request) => {
    const { token } = request.params as { token: string };
    const order = await prisma.order.findFirst({
      where: {
        giftToken: token,
        OR: [
          { stripePaymentId: { not: null } },
          { status: { in: [OrderStatus.PAID, OrderStatus.GENERATING, OrderStatus.COMPLETED] } },
        ],
      },
      include: orderSelect(),
    });

    if (!order) {
      throw createError(404, "Gift not found.");
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        giftViewedAt: new Date(),
      },
    });

    return serializeOrder(order);
  });

  /* ── Print-on-demand (Printful) endpoints ─────────────── */

  app.get("/api/print/products", async () => {
    return {
      available: isPrintfulConfigured(),
      products: getPrintProductList(),
    };
  });

  app.post("/api/print/estimate", async (request) => {
    const user = requireUser(request);
    const body = request.body as {
      portraitId: string;
      productType: PrintProductType;
      size: PrintSize;
      frameColor?: string;
      address: {
        name: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        zip: string;
        country?: string;
        email?: string;
        phone?: string;
      };
    };

    if (!isPrintfulConfigured()) throw createError(503, "Print service is not available.");

    const portrait = await prisma.portrait.findFirst({
      where: { id: body.portraitId, order: { userId: user.id } },
      include: { order: true },
    });
    if (!portrait) throw createError(404, "Portrait not found.");
    if (!orderIsPaid(portrait.order)) throw createError(402, "Portrait order must be paid first.");
    if (!portrait.printReadyKey) throw createError(400, "Print-ready file is not available yet.");

    const frame = requiresFrame(body.productType) ? (body.frameColor ?? "black") : "none";
    const variant = getVariant(body.productType, body.size, frame);
    if (!variant) throw createError(400, "Invalid product/size/frame combination.");

    const retailPrice = getRetailPrice(body.productType, body.size);
    if (!retailPrice) throw createError(400, "Invalid product/size combination.");

    const recipient = {
      name: body.address.name,
      address1: body.address.address1,
      address2: body.address.address2,
      city: body.address.city,
      state_code: body.address.state,
      country_code: body.address.country ?? "US",
      zip: body.address.zip,
      email: body.address.email,
      phone: body.address.phone,
    };

    const shippingRates = await estimateShipping(recipient, [
      { variant_id: variant.variantId, quantity: 1 },
    ]);

    const standardRate = shippingRates.find((r) => r.id === "STANDARD") ?? shippingRates[0];
    const shippingCost = standardRate ? Math.round(parseFloat(standardRate.rate) * 100) : 0;

    return {
      retailPrice,
      shippingCost,
      total: retailPrice + shippingCost,
      shippingMethod: standardRate?.name ?? "Standard",
      estimatedDays: standardRate
        ? `${standardRate.minDeliveryDays}-${standardRate.maxDeliveryDays} business days`
        : "5-10 business days",
    };
  });

  app.post("/api/print/orders", async (request) => {
    const user = requireUser(request);
    const body = request.body as {
      portraitId: string;
      productType: PrintProductType;
      size: PrintSize;
      frameColor?: string;
      address: {
        name: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        zip: string;
        country?: string;
        email?: string;
        phone?: string;
      };
    };

    if (!isPrintfulConfigured()) throw createError(503, "Print service is not available.");

    const portrait = await prisma.portrait.findFirst({
      where: { id: body.portraitId, order: { userId: user.id } },
      include: { order: true },
    });
    if (!portrait) throw createError(404, "Portrait not found.");
    if (!orderIsPaid(portrait.order)) throw createError(402, "Portrait order must be paid first.");
    if (!portrait.printReadyKey) throw createError(400, "Print-ready file is not available yet.");

    const frame = requiresFrame(body.productType) ? (body.frameColor ?? "black") : "none";
    const variant = getVariant(body.productType, body.size, frame);
    if (!variant) throw createError(400, "Invalid product/size/frame combination.");

    const retailPrice = getRetailPrice(body.productType, body.size);
    if (!retailPrice) throw createError(400, "Invalid product/size combination.");

    // Estimate shipping
    const recipient = {
      name: body.address.name,
      address1: body.address.address1,
      address2: body.address.address2,
      city: body.address.city,
      state_code: body.address.state,
      country_code: body.address.country ?? "US",
      zip: body.address.zip,
      email: body.address.email ?? user.email,
      phone: body.address.phone,
    };

    const shippingRates = await estimateShipping(recipient, [
      { variant_id: variant.variantId, quantity: 1 },
    ]);
    const standardRate = shippingRates.find((r) => r.id === "STANDARD") ?? shippingRates[0];
    const shippingCost = standardRate ? Math.round(parseFloat(standardRate.rate) * 100) : 0;

    const printOrder = await prisma.printOrder.create({
      data: {
        orderId: portrait.orderId,
        portraitId: portrait.id,
        userId: user.id,
        productType: body.productType,
        size: body.size,
        frameColor: frame === "none" ? null : frame,
        printfulVariantId: variant.variantId,
        retailPrice,
        shippingCost,
        printfulCost: 0,
        recipientName: body.address.name,
        recipientAddress1: body.address.address1,
        recipientAddress2: body.address.address2 ?? null,
        recipientCity: body.address.city,
        recipientState: body.address.state,
        recipientZip: body.address.zip,
        recipientCountry: body.address.country ?? "US",
        recipientEmail: body.address.email ?? user.email,
        recipientPhone: body.address.phone ?? null,
      },
    });

    // Create Stripe checkout for print order
    if (!stripe && env.NODE_ENV !== "production") {
      // Dev mode: skip Stripe, mark as paid immediately
      await submitPaidPrintOrder(printOrder.id, `demo_pi_print_${printOrder.id}`, `demo_cs_print_${printOrder.id}`);
      return { printOrderId: printOrder.id, checkoutUrl: `${env.FRONTEND_URL}/order/${portrait.orderId}?print_paid=1` };
    }

    if (!stripe) throw createError(503, "Payments are not configured.");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.FRONTEND_URL}/order/${portrait.orderId}?print_order=${printOrder.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/order/${portrait.orderId}`,
      customer_email: user.email,
      metadata: {
        printOrderId: printOrder.id,
        type: "print_order",
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            ...((() => {
              const productMap: Record<string, string> = {
                FRAMED_POSTER: env.STRIPE_PRODUCT_FRAMED_PRINT,
                CANVAS: env.STRIPE_PRODUCT_CANVAS,
                FRAMED_CANVAS: env.STRIPE_PRODUCT_FRAMED_CANVAS,
              };
              const productId = productMap[body.productType];
              const label = `${body.productType === "FRAMED_POSTER" ? "Framed Print" : body.productType === "CANVAS" ? "Canvas" : "Framed Canvas"} (${body.size})`;
              return productId
                ? { product: productId }
                : { product_data: { name: label, description: `Memorial portrait for ${portrait.order.petName}` } };
            })()),
            unit_amount: retailPrice,
          },
          quantity: 1,
        },
        ...(shippingCost > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  ...(env.STRIPE_PRODUCT_SHIPPING
                    ? { product: env.STRIPE_PRODUCT_SHIPPING }
                    : { product_data: { name: "Shipping" } }),
                  unit_amount: shippingCost,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
    });

    await prisma.printOrder.update({
      where: { id: printOrder.id },
      data: { stripeSessionId: session.id },
    });

    return { printOrderId: printOrder.id, checkoutUrl: session.url };
  });

  app.get("/api/print/orders", async (request) => {
    const user = requireUser(request);
    return prisma.printOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        portrait: { select: { style: true, previewUrl: true } },
        order: { select: { petName: true } },
      },
    });
  });

  app.get("/api/print/orders/:id", async (request) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };
    const printOrder = await prisma.printOrder.findFirst({
      where: { id, userId: user.id },
      include: {
        portrait: { select: { style: true, previewUrl: true } },
        order: { select: { petName: true } },
      },
    });
    if (!printOrder) throw createError(404, "Print order not found.");
    return printOrder;
  });

  // Printful webhook
  app.post("/api/webhooks/printful", {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const signature = request.headers["x-pf-webhook-signature"];
    const payload = typeof request.rawBody === "string" ? request.rawBody : request.rawBody?.toString("utf8") ?? "";
    if (
      typeof signature !== "string" ||
      !verifyPrintfulWebhookSignature(payload, signature, env.PRINTFUL_WEBHOOK_SECRET)
    ) {
      return reply.status(400).send({ error: "Invalid Printful webhook signature." });
    }

    const body = request.body as {
      type?: string;
      data?: {
        order?: {
          id?: number;
          external_id?: string;
          status?: string;
          shipments?: Array<{
            carrier?: string;
            tracking_number?: string;
            tracking_url?: string;
          }>;
        };
      };
    };

    const printfulOrderId = body.data?.order?.id;
    if (!printfulOrderId) return { received: true };

    const printOrder = await prisma.printOrder.findFirst({
      where: { printfulOrderId },
    });
    if (!printOrder) return { received: true };

    const eventType = body.type;
    const shipment = body.data?.order?.shipments?.[0];

    if (eventType === "package_shipped" && shipment) {
      await prisma.printOrder.update({
        where: { id: printOrder.id },
        data: {
          status: "SHIPPED",
          printfulStatus: body.data?.order?.status ?? "shipped",
          trackingNumber: shipment.tracking_number ?? null,
          trackingUrl: shipment.tracking_url ?? null,
          shippingCarrier: shipment.carrier ?? null,
        },
      });
    } else if (eventType === "order_failed") {
      await prisma.printOrder.update({
        where: { id: printOrder.id },
        data: {
          status: "FAILED",
          printfulStatus: body.data?.order?.status ?? "failed",
        },
      });
    } else if (eventType === "order_updated") {
      const pfStatus = body.data?.order?.status;
      const mapped = pfStatus === "inprocess" ? "IN_PRODUCTION"
        : pfStatus === "fulfilled" ? "SHIPPED"
        : pfStatus === "canceled" ? "CANCELED"
        : null;
      if (mapped) {
        await prisma.printOrder.update({
          where: { id: printOrder.id },
          data: {
            status: mapped,
            printfulStatus: pfStatus,
          },
        });
      }
    }

    return { received: true };
  });
}

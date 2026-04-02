import type { FastifyInstance, FastifyRequest } from "fastify";
import archiver from "archiver";
import { DiscountType, PackageType, PetType, PortraitStyle } from "@prisma/client";
import sharp from "sharp";
import Stripe from "stripe";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getPackageStyles, PACKAGE_PRICING } from "../lib/catalog.js";
import { prisma } from "../lib/prisma.js";
import { createPrintGuidePdf } from "../lib/print-guide.js";
import { getObjectBuffer, uploadBuffer, deleteObject } from "../lib/storage.js";
import { stripe } from "../lib/stripe.js";
import { handlePaidOrder } from "../services/generation.js";

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

function orderIsPaid(order: { stripePaymentId: string | null }) {
  return Boolean(order.stripePaymentId);
}

function serializeOrder<T extends {
  stripePaymentId: string | null;
  portraits: Array<{
    id: string;
    style: PortraitStyle;
    status: string;
    previewUrl: string | null;
    fullUrl: string | null;
    printReadyUrl: string | null;
  }>;
}>(order: T) {
  const isPaid = orderIsPaid(order);

  return {
    ...order,
    isPaid,
    portraits: order.portraits.map((portrait) => ({
      ...portrait,
      fullUrl: isPaid ? portrait.fullUrl : null,
      printReadyUrl: isPaid ? portrait.printReadyUrl : null,
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
    const body = request.body as { code?: string; packageType?: PackageType };
    const packageType = body.packageType ?? PackageType.MEMORIAL;
    const base = PACKAGE_PRICING[packageType].amount;
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

    return serializeOrder(order);
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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${env.FRONTEND_URL}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/order/${order.id}`,
      customer_email: user.email,
      metadata: {
        orderId: order.id,
        userId: user.id,
      },
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `${PACKAGE_PRICING[order.packageType].label} for ${order.petName}`,
                },
                unit_amount: order.amount,
              },
              quantity: 1,
            },
          ],
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return { checkoutUrl: session.url };
  });

  app.post(
    "/api/webhooks/stripe",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        return { received: true };
      }

      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        throw createError(400, "Missing Stripe signature.");
      }

      const payload = typeof request.rawBody === "string" ? request.rawBody : request.rawBody?.toString("utf8") ?? "";
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({ error: "Invalid Stripe webhook signature." });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await handlePaidOrder(
            orderId,
            typeof session.payment_intent === "string" ? session.payment_intent : null,
            session.id,
          );
        }
      }

      return { received: true };
    },
  );

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
          },
        },
      },
    });

    if (!portrait) {
      throw createError(404, "Portrait not found.");
    }

    if (!portrait.order.stripePaymentId && variant !== "preview") {
      throw createError(402, "Payment is required to download high-resolution files.");
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

    for (const portrait of order.portraits) {
      if (portrait.fullKey) {
        const full = await getObjectBuffer(portrait.fullKey);
        archive.append(full, { name: `${portrait.style.toLowerCase()}-full.png` });
      }
      if (portrait.printReadyKey) {
        const print = await getObjectBuffer(portrait.printReadyKey);
        archive.append(print, { name: `${portrait.style.toLowerCase()}-print-ready.png` });
      }
    }

    archive.append(createPrintGuidePdf(order.petName), { name: "print-guide.pdf" });
    await archive.finalize();
    return reply;
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
      where: { giftToken: token, stripePaymentId: { not: null } },
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
}

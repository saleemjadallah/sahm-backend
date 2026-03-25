// ─── Credit Packs (amounts in fils — 1 AED = 100 fils) ──

export const CREDIT_PACKS = {
  PACK_10: { credits: 10, priceAed: 2900 },    // AED 29
  PACK_50: { credits: 50, priceAed: 9900 },    // AED 99
  PACK_100: { credits: 100, priceAed: 14900 },  // AED 149
  PACK_500: { credits: 500, priceAed: 49900 },  // AED 499
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

// ─── Generation Costs ────────────────────────────────────

export const GENERATION_COSTS = {
  STANDARD: 1,      // standard single image
  HD: 2,            // 4K resolution
  PACK_ITEM: 1,     // each item in a pack
} as const;

// ─── Subscription Credits ────────────────────────────────

export const SUBSCRIPTION_CREDITS = {
  FREE: 3,          // signup bonus (one-time)
  STARTER: 20,      // per month
  PRO: 100,         // per month
  UNLIMITED: 999999, // effectively unlimited
} as const;

// ─── Supported Languages ─────────────────────────────────

export const SUPPORTED_LANGUAGES = ["en", "ar", "hi"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ─── Watermark Text ──────────────────────────────────────

export const WATERMARK_TEXT = "sahm.app ✦ سهم";
export const WATERMARK_OPACITY = 0.3;
export const PREVIEW_MAX_WIDTH = 1200;

// ─── Rate Limits ─────────────────────────────────────────

export const RATE_LIMITS = {
  GLOBAL: { max: 100, timeWindow: "1 minute" },
  AUTH: { max: 10, timeWindow: "1 minute" },
  GENERATE: { max: 5, timeWindow: "1 minute" },
  TRANSLATE: { max: 30, timeWindow: "1 minute" },
} as const;

// ─── JWT Defaults ────────────────────────────────────────

export const JWT_DEFAULTS = {
  ACCESS_EXPIRY: "15m",
  REFRESH_EXPIRY: "7d",
} as const;

// ─── File Upload ─────────────────────────────────────────

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME_TYPES: ["image/png", "image/jpeg", "image/webp", "text/csv"],
} as const;

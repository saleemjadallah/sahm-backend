import type { DesignType, ProjectType } from "@prisma/client";

// ─── Pricing (amounts in fils — 1 AED = 100 fils) ─────

export const PRICING = {
  SINGLE_DESIGN: 1900,          // AED 19
  SINGLE_DESIGN_PREMIUM: 2900,  // AED 29

  // Wedding
  WEDDING_SUITE: 49900,         // AED 499
  WEDDING_SUITE_RSVP: 69900,   // AED 699

  // Baby
  BABY_SET: 14900,              // AED 149
  BABY_JOURNEY: 29900,          // AED 299

  // Credit packs
  CREDIT_PACK_10: 14900,        // AED 149
  CREDIT_PACK_30: 34900,        // AED 349

  // Subscriptions
  SUB_STARTER: 2900,            // AED 29/mo
  SUB_UNLIMITED: 7900,          // AED 79/mo
} as const;

// ─── Design Types per Project Type ─────────────────────

export const DESIGN_TYPES_BY_PROJECT: Record<string, DesignType[]> = {
  WEDDING: [
    "WEDDING_INVITATION",
    "WEDDING_SAVE_THE_DATE",
    "WEDDING_RSVP_CARD",
    "WEDDING_MENU_CARD",
    "WEDDING_TABLE_NUMBER",
    "WEDDING_WELCOME_SIGN",
    "WEDDING_THANK_YOU",
    "WEDDING_INSTAGRAM_POST",
    "WEDDING_WHATSAPP_CARD",
  ],
  BABY: [
    "BABY_BIRTH_ANNOUNCEMENT",
    "BABY_NURSERY_ART",
    "BABY_AQEEQAH_INVITE",
    "BABY_WHATSAPP_CARD",
    "BABY_THANK_YOU",
  ],
  WALL_ART: [
    "WALL_ART_CUSTOM",
    "WALL_ART_QURANIC",
    "WALL_ART_NAME",
    "WALL_ART_QUOTE",
  ],
  GIFT: [
    "GIFT_EID_CARD",
    "GIFT_RAMADAN_CARD",
    "GIFT_CUSTOM",
  ],
} as const;

// ─── Milestone Day Offsets ─────────────────────────────

export const MILESTONE_OFFSETS = {
  DAY_7: 7,
  DAY_40: 40,
  MONTH_1: 30,
  MONTH_2: 60,
  MONTH_3: 90,
  MONTH_6: 180,
  MONTH_9: 270,
  YEAR_1: 365,
  FIRST_RAMADAN: null,   // Calculated dynamically based on Hijri calendar
  FIRST_EID: null,       // Calculated dynamically based on Hijri calendar
} as const;

// ─── Cities List ───────────────────────────────────────

export const CITIES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Riyadh",
  "Jeddah",
  "Mecca",
  "Medina",
  "Doha",
  "Kuwait City",
  "Manama",
  "Muscat",
  "Amman",
  "Cairo",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Bengaluru",
  "Chennai",
  "Kolkata",
  "London",
  "Other",
] as const;

// ─── Supported Languages ──────────────────────────────

export const SUPPORTED_LANGUAGES = ["en", "ar", "hi"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ─── Watermark Text ────────────────────────────────────

export const WATERMARK_TEXT = "sahm.app \u2726 \u0633\u0647\u0645";
export const WATERMARK_OPACITY = 0.3;
export const PREVIEW_MAX_WIDTH = 1200;

// ─── Rate Limits ───────────────────────────────────────

export const RATE_LIMITS = {
  GLOBAL: { max: 100, timeWindow: "1 minute" },
  AUTH: { max: 10, timeWindow: "1 minute" },
  GENERATE: { max: 5, timeWindow: "1 minute" },
  TRANSLATE: { max: 30, timeWindow: "1 minute" },
} as const;

// ─── JWT Defaults ──────────────────────────────────────

export const JWT_DEFAULTS = {
  ACCESS_EXPIRY: "15m",
  REFRESH_EXPIRY: "7d",
} as const;

// ─── File Upload ───────────────────────────────────────

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME_TYPES: ["image/png", "image/jpeg", "image/webp", "text/csv"],
} as const;

import { cleanEnv, str, port, num, url } from "envalid";
import dotenv from "dotenv";

dotenv.config();

export const env = cleanEnv(process.env, {
  // Application
  NODE_ENV: str({ choices: ["development", "production", "test"], default: "development" }),
  PORT: port({ default: 4000 }),
  FRONTEND_URL: url({ default: "http://localhost:3000" }),
  APP_URL: url({ default: "http://localhost:4000" }),

  // Database
  DATABASE_URL: str({ default: "" }),

  // JWT / Auth
  JWT_SECRET: str({ default: "dev-jwt-secret-change-in-production" }),
  JWT_REFRESH_SECRET: str({ default: "dev-jwt-refresh-secret-change-in-production" }),
  JWT_ACCESS_EXPIRY: str({ default: "15m" }),
  JWT_REFRESH_EXPIRY: str({ default: "7d" }),

  // Google OAuth
  GOOGLE_CLIENT_ID: str({ default: "" }),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),

  // Clerk
  CLERK_SECRET_KEY: str({ default: "" }),
  CLERK_JWT_KEY: str({ default: "" }),

  // Gemini AI
  GEMINI_API_KEY: str({ default: "" }),
  GEMINI_MODEL: str({ default: "gemini-3.1-flash-image-preview" }),
  GEMINI_IMAGE_MODEL: str({ default: "gemini-3-pro-image-preview" }),
  GEMINI_MAX_CONCURRENT: num({ default: 3 }),

  // Cloudflare R2
  R2_ACCESS_KEY: str({ default: "" }),
  R2_SECRET_KEY: str({ default: "" }),
  R2_BUCKET: str({ default: "sahm-designs" }),
  R2_ENDPOINT: str({ default: "" }),
  R2_PUBLIC_URL: str({ default: "" }),

  // Stripe
  STRIPE_SECRET_KEY: str({ default: "" }),
  STRIPE_PUBLISHABLE_KEY: str({ default: "" }),
  STRIPE_WEBHOOK_SECRET: str({ default: "" }),

  // Resend
  RESEND_API_KEY: str({ default: "" }),
  EMAIL_FROM: str({ default: "Sahm <noreply@sahm.app>" }),

  // WhatsApp (Phase 2)
  WHATSAPP_TOKEN: str({ default: "" }),
  WHATSAPP_PHONE_ID: str({ default: "" }),

  // Meta Conversions API
  META_CAPI_TOKEN: str({ default: "" }),
});

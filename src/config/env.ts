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
  DATABASE_URL: str(),

  // JWT / Auth
  JWT_SECRET: str(),
  JWT_REFRESH_SECRET: str(),
  JWT_ACCESS_EXPIRY: str({ default: "15m" }),
  JWT_REFRESH_EXPIRY: str({ default: "7d" }),

  // Google OAuth
  GOOGLE_CLIENT_ID: str(),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),

  // Gemini AI
  GEMINI_API_KEY: str(),
  GEMINI_MODEL: str({ default: "gemini-2.0-flash-exp" }),
  GEMINI_IMAGE_MODEL: str({ default: "gemini-2.0-flash-exp" }),
  GEMINI_MAX_CONCURRENT: num({ default: 3 }),

  // Cloudflare R2
  R2_ACCESS_KEY: str(),
  R2_SECRET_KEY: str(),
  R2_BUCKET: str({ default: "sahm-designs" }),
  R2_ENDPOINT: str(),
  R2_PUBLIC_URL: str(),

  // Stripe
  STRIPE_SECRET_KEY: str(),
  STRIPE_PUBLISHABLE_KEY: str({ default: "" }),
  STRIPE_WEBHOOK_SECRET: str(),

  // Resend
  RESEND_API_KEY: str(),
  EMAIL_FROM: str({ default: "Sahm <noreply@sahm.app>" }),

  // WhatsApp (Phase 2)
  WHATSAPP_TOKEN: str({ default: "" }),
  WHATSAPP_PHONE_ID: str({ default: "" }),
});

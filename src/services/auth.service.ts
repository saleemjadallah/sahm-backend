import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { UnauthorizedError, ConflictError, ValidationError } from "../errors/index.js";
import { sendEmail } from "./email.service.js";
import type { TokenPair, AuthResponse, JwtPayload, AuthUser } from "../types/index.js";

// ─── Magic Link ────────────────────────────────────────

/**
 * Generate a magic link token, hash it, store it, and send the email via Resend.
 */
export async function sendMagicLink(
  prisma: PrismaClient,
  email: string,
): Promise<void> {
  const token = nanoid(32);
  const hashedToken = await bcrypt.hash(token, 10);
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Upsert user — create if doesn't exist
  await prisma.user.upsert({
    where: { email },
    update: {
      magicLinkToken: hashedToken,
      magicLinkExpiry: expiry,
    },
    create: {
      email,
      magicLinkToken: hashedToken,
      magicLinkExpiry: expiry,
    },
  });

  const magicLinkUrl = `${env.FRONTEND_URL}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`;

  await sendEmail({
    to: email,
    subject: "Sign in to Sahm \u0633\u0647\u0645",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a3e; text-align: center;">\u0633\u0647\u0645 Sahm</h1>
        <p style="color: #333; font-size: 16px; text-align: center;">Click the button below to sign in to your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLinkUrl}" style="background: #d4a853; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Sign In / \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644
          </a>
        </div>
        <p style="color: #999; font-size: 13px; text-align: center;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Verify a magic link token and return JWT pair.
 */
export async function verifyMagicLink(
  prisma: PrismaClient,
  email: string,
  token: string,
): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.magicLinkToken || !user.magicLinkExpiry) {
    throw new UnauthorizedError("Invalid or expired magic link");
  }

  if (new Date() > user.magicLinkExpiry) {
    throw new UnauthorizedError("Magic link has expired");
  }

  const isValid = await bcrypt.compare(token, user.magicLinkToken);
  if (!isValid) {
    throw new UnauthorizedError("Invalid magic link token");
  }

  // Clear the magic link token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      magicLinkToken: null,
      magicLinkExpiry: null,
    },
  });

  const tokens = generateTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    },
    tokens,
  };
}

// ─── Google OAuth ──────────────────────────────────────

/**
 * Handle Google OAuth: verify the ID token, upsert the user, return JWT pair.
 */
export async function handleGoogleAuth(
  prisma: PrismaClient,
  idToken: string,
): Promise<AuthResponse> {
  // Verify the Google ID token
  const googlePayload = await verifyGoogleToken(idToken);

  if (!googlePayload.email) {
    throw new ValidationError("Google account has no email");
  }

  // Upsert user — link Google account
  const user = await prisma.user.upsert({
    where: { email: googlePayload.email },
    update: {
      googleId: googlePayload.sub,
      name: googlePayload.name || undefined,
    },
    create: {
      email: googlePayload.email,
      googleId: googlePayload.sub,
      name: googlePayload.name || null,
    },
  });

  const tokens = generateTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    },
    tokens,
  };
}

// ─── Token Generation ──────────────────────────────────

/**
 * Generate access + refresh JWT tokens.
 */
export function generateTokens(userId: string, email: string): TokenPair {
  const accessExpiry = env.JWT_ACCESS_EXPIRY as SignOptions["expiresIn"];
  const refreshExpiry = env.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"];

  const accessToken = jwt.sign(
    { sub: userId, email } satisfies JwtPayload,
    env.JWT_SECRET,
    { expiresIn: accessExpiry },
  );

  const refreshToken = jwt.sign(
    { sub: userId, email } satisfies JwtPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: refreshExpiry },
  );

  return { accessToken, refreshToken };
}

/**
 * Refresh an access token using a valid refresh token.
 */
export async function refreshAccessToken(
  prisma: PrismaClient,
  refreshToken: string,
): Promise<TokenPair> {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    return generateTokens(user.id, user.email);
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid refresh token");
  }
}

// ─── Google Token Verification ─────────────────────────

interface GoogleTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
  // Verify with Google's token info endpoint
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  );

  if (!response.ok) {
    throw new UnauthorizedError("Invalid Google ID token");
  }

  const payload = (await response.json()) as GoogleTokenPayload & { aud?: string };

  // Verify the token was meant for our application
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new UnauthorizedError("Google token audience mismatch");
  }

  return payload;
}

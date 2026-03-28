import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const GUEST_GENERATION_TOKEN_TYPE = "guest_generation";
const GUEST_GENERATION_TOKEN_TTL = "7d";

type GuestGenerationTokenPayload = {
  type: typeof GUEST_GENERATION_TOKEN_TYPE;
  generationId: string;
  iat?: number;
  exp?: number;
};

export function createGuestGenerationToken(generationId: string): string {
  return jwt.sign(
    {
      type: GUEST_GENERATION_TOKEN_TYPE,
      generationId,
    } satisfies GuestGenerationTokenPayload,
    env.JWT_SECRET,
    { expiresIn: GUEST_GENERATION_TOKEN_TTL },
  );
}

export function verifyGuestGenerationToken(
  token: string,
  generationId: string,
): boolean {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as GuestGenerationTokenPayload;
    return payload.type === GUEST_GENERATION_TOKEN_TYPE && payload.generationId === generationId;
  } catch {
    return false;
  }
}

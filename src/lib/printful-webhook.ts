import { createHmac, timingSafeEqual } from "node:crypto";

function isHex(value: string) {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

export function verifyPrintfulWebhookSignature(payload: string, signature: string | undefined, secret: string) {
  if (!signature || !secret) {
    return false;
  }

  const normalizedSignature = signature.trim().toLowerCase();
  const normalizedSecret = secret.trim().toLowerCase();
  if (!isHex(normalizedSignature) || !isHex(normalizedSecret)) {
    return false;
  }

  const expected = createHmac("sha256", Buffer.from(normalizedSecret, "hex"))
    .update(payload, "utf8")
    .digest();
  const received = Buffer.from(normalizedSignature, "hex");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPrintfulWebhookSignature } from "./printful-webhook.js";

describe("verifyPrintfulWebhookSignature", () => {
  const payload = JSON.stringify({ type: "order_updated", data: { order: { id: 42 } } });
  const secret = "00112233445566778899aabbccddeeff";
  const validSignature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(payload, "utf8")
    .digest("hex");

  it("accepts a valid signature", () => {
    assert.equal(verifyPrintfulWebhookSignature(payload, validSignature, secret), true);
  });

  it("rejects a missing signature", () => {
    assert.equal(verifyPrintfulWebhookSignature(payload, undefined, secret), false);
  });

  it("rejects a malformed signature", () => {
    assert.equal(verifyPrintfulWebhookSignature(payload, "not-hex", secret), false);
  });

  it("rejects a mismatched signature", () => {
    assert.equal(verifyPrintfulWebhookSignature(payload, "aa".repeat(32), secret), false);
  });
});

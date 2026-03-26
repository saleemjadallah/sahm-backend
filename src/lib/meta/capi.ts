import crypto from "crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../../config/env.js";

const PIXEL_ID = "4360485080875647";
const API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

// ─── Helpers ──────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Extract real client IP from behind Cloudflare / proxies. */
export function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers["cf-connecting-ip"] as string) ||
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    request.ip
  );
}

// ─── Core Event Sender ────────────────────────────────────

interface UserData {
  email?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

interface MetaEvent {
  eventName: string;
  eventSourceUrl: string;
  eventId?: string;
  userData: UserData;
  customData?: Record<string, unknown>;
}

async function sendEvent(event: MetaEvent): Promise<void> {
  if (!env.META_CAPI_TOKEN) return;

  const userData: Record<string, unknown> = {};
  if (event.userData.email) {
    userData.em = [sha256(event.userData.email)];
  }
  if (event.userData.externalId) {
    userData.external_id = [sha256(event.userData.externalId)];
  }
  if (event.userData.clientIpAddress) {
    userData.client_ip_address = event.userData.clientIpAddress;
  }
  if (event.userData.clientUserAgent) {
    userData.client_user_agent = event.userData.clientUserAgent;
  }

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        ...(event.eventId && { event_id: event.eventId }),
        user_data: userData,
        ...(event.customData && { custom_data: event.customData }),
      },
    ],
    access_token: env.META_CAPI_TOKEN,
  };

  try {
    const res = await fetch(GRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Meta CAPI error:", { status: res.status, body });
    }
  } catch (err) {
    console.error("Meta CAPI request failed:", err instanceof Error ? err.message : String(err));
  }
}

// ─── Event Helpers (fire-and-forget) ──────────────────────

export function trackCompleteRegistration(params: {
  email: string;
  userId: string;
  ip?: string;
  userAgent?: string;
}): void {
  sendEvent({
    eventName: "CompleteRegistration",
    eventSourceUrl: `${env.FRONTEND_URL}/sign-up`,
    eventId: `reg_${params.userId}`,
    userData: {
      email: params.email,
      externalId: params.userId,
      clientIpAddress: params.ip,
      clientUserAgent: params.userAgent,
    },
  }).catch(() => {});
}

export function trackInitiateCheckout(params: {
  email: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  currency: string;
  value: number;
  contentName: string;
}): void {
  sendEvent({
    eventName: "InitiateCheckout",
    eventSourceUrl: `${env.FRONTEND_URL}/credits`,
    eventId: `checkout_${params.userId}_${Date.now()}`,
    userData: {
      email: params.email,
      externalId: params.userId,
      clientIpAddress: params.ip,
      clientUserAgent: params.userAgent,
    },
    customData: {
      currency: params.currency,
      value: params.value,
      content_name: params.contentName,
    },
  }).catch(() => {});
}

export function trackPurchase(params: {
  email: string;
  userId: string;
  currency: string;
  value: number;
  contentName: string;
  transactionId: string;
}): void {
  sendEvent({
    eventName: "Purchase",
    eventSourceUrl: `${env.FRONTEND_URL}/credits`,
    eventId: `purchase_${params.transactionId}`,
    userData: {
      email: params.email,
      externalId: params.userId,
    },
    customData: {
      currency: params.currency,
      value: params.value,
      content_name: params.contentName,
    },
  }).catch(() => {});
}

export function trackViewContent(params: {
  ip?: string;
  userAgent?: string;
  email?: string;
  userId?: string;
  contentName: string;
  contentId: string;
}): void {
  sendEvent({
    eventName: "ViewContent",
    eventSourceUrl: `${env.FRONTEND_URL}/create/${params.contentName}`,
    userData: {
      email: params.email,
      externalId: params.userId,
      clientIpAddress: params.ip,
      clientUserAgent: params.userAgent,
    },
    customData: {
      content_name: params.contentName,
      content_ids: [params.contentId],
      content_type: "product",
    },
  }).catch(() => {});
}

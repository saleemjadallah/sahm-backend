import crypto from "node:crypto";
import { env } from "../config/env.js";

const GRAPH_API_VERSION = "v22.0";

interface UserData {
  em?: string; // email — will be SHA-256 hashed
  fn?: string; // first name — will be SHA-256 hashed
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string; // click ID cookie
  fbp?: string; // browser ID cookie
}

interface PurchaseEventParams {
  eventId: string;
  value: number; // in dollars
  currency: string;
  contentName?: string;
  contentIds?: string[];
  numItems?: number;
  userData: UserData;
  eventSourceUrl?: string;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function buildUserData(raw: UserData): Record<string, string | undefined> {
  return {
    em: raw.em ? sha256(raw.em) : undefined,
    fn: raw.fn ? sha256(raw.fn) : undefined,
    client_ip_address: raw.client_ip_address,
    client_user_agent: raw.client_user_agent,
    fbc: raw.fbc,
    fbp: raw.fbp,
  };
}

export async function sendPurchaseEvent(params: PurchaseEventParams): Promise<void> {
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) {
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_ACCESS_TOKEN}`;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        event_source_url: params.eventSourceUrl,
        action_source: "website",
        user_data: buildUserData(params.userData),
        custom_data: {
          value: params.value,
          currency: params.currency,
          content_name: params.contentName,
          content_ids: params.contentIds,
          content_type: "product",
          num_items: params.numItems,
        },
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[Meta CAPI] Error sending Purchase event:", response.status, body);
    }
  } catch (error) {
    // Non-blocking — don't let CAPI failures affect order processing
    console.error("[Meta CAPI] Failed to send Purchase event:", error);
  }
}

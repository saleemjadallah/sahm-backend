/** Printful API client for creating and managing print orders. */

import { env } from "../config/env.js";

const BASE_URL = "https://api.printful.com";
const printfulApiToken = env.PRINTFUL_API_TOKEN || env.PRINTFUL_SECRET_KEY;

interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  email?: string;
  phone?: string;
}

interface PrintfulOrderItem {
  variant_id: number;
  quantity: number;
  files: Array<{ type: string; url: string }>;
}

interface PrintfulCreateOrder {
  external_id: string;
  shipping: string;
  recipient: PrintfulRecipient;
  items: PrintfulOrderItem[];
  packing_slip?: {
    store_name?: string;
    message?: string;
    email?: string;
  };
}

async function printfulFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!printfulApiToken) {
    throw new Error("Printful API token is not configured.");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${printfulApiToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json()) as { code: number; result: T; error?: { message: string } };

  if (data.code < 200 || data.code >= 300) {
    throw new Error(`Printful API error (${data.code}): ${data.error?.message ?? "Unknown error"}`);
  }

  return data.result;
}

/** Estimate shipping rates for a print order. */
export async function estimateShipping(
  recipient: PrintfulRecipient,
  items: Array<{ variant_id: number; quantity: number }>,
) {
  return printfulFetch<Array<{ id: string; name: string; rate: string; currency: string; minDeliveryDays: number; maxDeliveryDays: number }>>(
    "/shipping/rates",
    {
      method: "POST",
      body: { recipient, items },
    },
  );
}

/** Create a draft order on Printful. */
export async function createOrder(order: PrintfulCreateOrder) {
  return printfulFetch<{
    id: number;
    external_id: string;
    status: string;
    shipping: string;
    costs: { subtotal: string; shipping: string; tax: string; total: string };
  }>("/orders", {
    method: "POST",
    body: order,
  });
}

/** Confirm a draft order for fulfillment. */
export async function confirmOrder(printfulOrderId: number) {
  return printfulFetch<{ id: number; status: string }>(
    `/orders/${printfulOrderId}/confirm`,
    { method: "POST" },
  );
}

/** Get order status from Printful. */
export async function getOrder(printfulOrderId: number) {
  return printfulFetch<{
    id: number;
    external_id: string;
    status: string;
    shipments: Array<{
      carrier: string;
      service: string;
      tracking_number: string;
      tracking_url: string;
      ship_date: string;
    }>;
  }>(`/orders/${printfulOrderId}`);
}

/** Cancel a Printful order. */
export async function cancelOrder(printfulOrderId: number) {
  return printfulFetch<{ id: number; status: string }>(
    `/orders/${printfulOrderId}`,
    { method: "DELETE" },
  );
}

/** Estimate the full cost of an order before creating it. */
export async function estimateOrderCosts(order: PrintfulCreateOrder) {
  return printfulFetch<{
    costs: { currency: string; subtotal: string; discount: string; shipping: string; tax: string; total: string };
    retail_costs: { currency: string; subtotal: string; shipping: string; tax: string; total: string };
  }>("/orders/estimate", {
    method: "POST",
    body: order,
  });
}

/** Check if Printful is configured and available. */
export function isPrintfulConfigured() {
  return Boolean(printfulApiToken);
}

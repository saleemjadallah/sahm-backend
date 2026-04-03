import { PortraitStatus, type PortraitStyle } from "@prisma/client";
import { ADDON_CATALOG, ADDON_PORTRAIT_PRICE_CENTS, ADDON_PORTRAIT_STYLES, calculatePrice, getUnitPrice } from "./catalog.js";

type PricingPortrait = {
  id: string;
  style: PortraitStyle;
  selected: boolean;
  status?: PortraitStatus;
};

type PricingAddOn = {
  id: string;
  type: keyof typeof ADDON_CATALOG;
  priceCents: number;
  status?: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
};

type ChargedItem = {
  id: string;
  grossCents: number;
  failed: boolean;
};

export function getSelectedOrderPricing(
  portraits: PricingPortrait[],
  addOns: PricingAddOn[],
) {
  const addOnStyleSet = new Set<PortraitStyle>(ADDON_PORTRAIT_STYLES);
  const selectedPortraits = portraits.filter((portrait) => portrait.selected);
  const standardPortraits = selectedPortraits.filter((portrait) => !addOnStyleSet.has(portrait.style));
  const addOnPortraits = selectedPortraits.filter((portrait) => addOnStyleSet.has(portrait.style));

  const standardCount = standardPortraits.length;
  const addOnPortraitCount = addOnPortraits.length;
  const portraitSubtotal = calculatePrice(standardCount) + addOnPortraitCount * ADDON_PORTRAIT_PRICE_CENTS;
  const docAddOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.priceCents, 0);
  const subtotal = portraitSubtotal + docAddOnsTotal;

  return {
    selectedPortraits,
    standardPortraits,
    addOnPortraits,
    standardCount,
    addOnPortraitCount,
    unitPrice: getUnitPrice(standardCount),
    portraitSubtotal,
    docAddOnsTotal,
    subtotal,
  };
}

function allocateChargedAmounts(items: Array<{ id: string; grossCents: number }>, chargedTotalCents: number) {
  const grossTotal = items.reduce((sum, item) => sum + item.grossCents, 0);
  if (grossTotal <= 0 || chargedTotalCents <= 0) {
    return new Map<string, number>();
  }

  const provisional = items.map((item) => {
    const exact = (item.grossCents / grossTotal) * chargedTotalCents;
    const floor = Math.floor(exact);
    return {
      id: item.id,
      floor,
      remainder: exact - floor,
    };
  });

  let remaining = chargedTotalCents - provisional.reduce((sum, item) => sum + item.floor, 0);
  provisional.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  const allocations = new Map<string, number>(provisional.map((item) => [item.id, item.floor]));
  for (const item of provisional) {
    if (remaining <= 0) break;
    allocations.set(item.id, (allocations.get(item.id) ?? 0) + 1);
    remaining -= 1;
  }

  return allocations;
}

export function calculateFailedOrderRefund(order: {
  amount: number;
  portraits: PricingPortrait[];
  addOns: PricingAddOn[];
}) {
  const pricing = getSelectedOrderPricing(order.portraits, order.addOns);
  const chargedItems: ChargedItem[] = [
    ...pricing.standardPortraits.map((portrait) => ({
      id: portrait.id,
      grossCents: pricing.unitPrice,
      failed: portrait.status === PortraitStatus.FAILED,
    })),
    ...pricing.addOnPortraits.map((portrait) => ({
      id: portrait.id,
      grossCents: ADDON_PORTRAIT_PRICE_CENTS,
      failed: portrait.status === PortraitStatus.FAILED,
    })),
    ...order.addOns.map((addOn) => ({
      id: addOn.id,
      grossCents: addOn.priceCents,
      failed: addOn.status === "FAILED",
    })),
  ];

  const allocations = allocateChargedAmounts(
    chargedItems.map((item) => ({ id: item.id, grossCents: item.grossCents })),
    order.amount,
  );

  return chargedItems.reduce((sum, item) => {
    if (!item.failed) return sum;
    return sum + (allocations.get(item.id) ?? 0);
  }, 0);
}

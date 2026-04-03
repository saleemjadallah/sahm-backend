import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateFailedOrderRefund, getSelectedOrderPricing } from "./order-pricing.js";

describe("getSelectedOrderPricing", () => {
  it("separates standard portraits from add-on portraits", () => {
    const pricing = getSelectedOrderPricing(
      [
        { id: "p1", style: "WATERCOLOR", selected: true },
        { id: "p2", style: "RENAISSANCE", selected: true },
        { id: "p3", style: "YOUNG_AGAIN", selected: true },
      ],
      [{ id: "a1", type: "LETTER_FROM_HEAVEN", priceCents: 499 }],
    );

    assert.equal(pricing.standardCount, 2);
    assert.equal(pricing.addOnPortraitCount, 1);
    assert.equal(pricing.portraitSubtotal, 2097);
    assert.equal(pricing.docAddOnsTotal, 499);
    assert.equal(pricing.subtotal, 2596);
  });
});

describe("calculateFailedOrderRefund", () => {
  it("refunds discounted failures proportionally across portraits and add-ons", () => {
    const refund = calculateFailedOrderRefund({
      amount: 2196,
      portraits: [
        { id: "p1", style: "WATERCOLOR", selected: true, status: "COMPLETED" },
        { id: "p2", style: "RENAISSANCE", selected: true, status: "FAILED" },
        { id: "p3", style: "YOUNG_AGAIN", selected: true, status: "COMPLETED" },
      ],
      addOns: [
        { id: "a1", type: "LETTER_FROM_HEAVEN", priceCents: 499, status: "FAILED" },
      ],
    });

    assert.equal(refund, 1098);
  });

  it("refunds the full charged amount when everything fails", () => {
    const refund = calculateFailedOrderRefund({
      amount: 1797,
      portraits: [
        { id: "p1", style: "WATERCOLOR", selected: true, status: "FAILED" },
        { id: "p2", style: "YOUNG_AGAIN", selected: true, status: "FAILED" },
      ],
      addOns: [
        { id: "a1", type: "LETTER_FROM_HEAVEN", priceCents: 499, status: "FAILED" },
      ],
    });

    assert.equal(refund, 1797);
  });
});

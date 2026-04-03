import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddOnStatus, PackageType, PortraitStatus } from "@prisma/client";
import {
  addOnHasPaidAssets,
  customOrderNeedsPostPaymentFulfillment,
  portraitHasPaidAssets,
} from "./generation.js";

describe("paid fulfillment helpers", () => {
  it("treats preview-only completed portraits as incomplete paid fulfillment", () => {
    const needsFulfillment = customOrderNeedsPostPaymentFulfillment({
      packageType: PackageType.CUSTOM,
      portraits: [
        {
          selected: true,
          status: PortraitStatus.COMPLETED,
          fullUrl: null,
          fullKey: null,
          printReadyUrl: null,
          printReadyKey: null,
        },
      ],
      addOns: [],
    });

    assert.equal(needsFulfillment, true);
  });

  it("treats fully rendered paid portraits and completed add-ons as complete", () => {
    const needsFulfillment = customOrderNeedsPostPaymentFulfillment({
      packageType: PackageType.CUSTOM,
      portraits: [
        {
          selected: true,
          status: PortraitStatus.COMPLETED,
          fullUrl: "https://cdn.example.com/full.png",
          fullKey: "portraits/full.png",
          printReadyUrl: "https://cdn.example.com/print.png",
          printReadyKey: "portraits/print.png",
        },
      ],
      addOns: [
        {
          status: AddOnStatus.COMPLETED,
          documentUrl: "https://cdn.example.com/letter.pdf",
          documentKey: "addons/letter.pdf",
        },
      ],
    });

    assert.equal(needsFulfillment, false);
  });

  it("does not keep retrying failed deliverables forever", () => {
    const needsFulfillment = customOrderNeedsPostPaymentFulfillment({
      packageType: PackageType.CUSTOM,
      portraits: [
        {
          selected: true,
          status: PortraitStatus.FAILED,
          fullUrl: null,
          fullKey: null,
          printReadyUrl: null,
          printReadyKey: null,
        },
      ],
      addOns: [
        {
          status: AddOnStatus.FAILED,
          documentUrl: null,
          documentKey: null,
        },
      ],
    });

    assert.equal(needsFulfillment, false);
  });

  it("requires completed add-ons to have an actual document", () => {
    assert.equal(
      addOnHasPaidAssets({
        status: AddOnStatus.COMPLETED,
        documentUrl: "https://cdn.example.com/storybook.pdf",
        documentKey: "addons/storybook.pdf",
      }),
      true,
    );

    assert.equal(
      addOnHasPaidAssets({
        status: AddOnStatus.COMPLETED,
        documentUrl: null,
        documentKey: null,
      }),
      false,
    );
  });

  it("requires portraits to have both full and print-ready assets", () => {
    assert.equal(
      portraitHasPaidAssets({
        selected: true,
        status: PortraitStatus.COMPLETED,
        fullUrl: "https://cdn.example.com/full.png",
        fullKey: "portraits/full.png",
        printReadyUrl: "https://cdn.example.com/print.png",
        printReadyKey: "portraits/print.png",
      }),
      true,
    );

    assert.equal(
      portraitHasPaidAssets({
        selected: true,
        status: PortraitStatus.COMPLETED,
        fullUrl: "https://cdn.example.com/full.png",
        fullKey: "portraits/full.png",
        printReadyUrl: null,
        printReadyKey: null,
      }),
      false,
    );
  });
});

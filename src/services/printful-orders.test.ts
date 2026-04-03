import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRINT_ORDER_SUBMITTING_STALE_MS, submitPaidPrintOrder, type SubmitPaidPrintOrderDeps } from "./printful-orders.js";

type FakePrintOrder = Awaited<ReturnType<SubmitPaidPrintOrderDeps["prisma"]["printOrder"]["findUnique"]>>;

function createDeps(orderOverrides: Partial<NonNullable<FakePrintOrder>> = {}) {
  const state: NonNullable<FakePrintOrder> = {
    id: "po_123",
    status: "PENDING",
    updatedAt: new Date("2026-04-03T10:00:00.000Z"),
    printfulOrderId: null,
    printfulStatus: null,
    printfulVariantId: 1350,
    printfulCost: 0,
    stripePaymentId: null,
    stripeSessionId: null,
    recipientName: "Jane Smith",
    recipientAddress1: "123 Main St",
    recipientAddress2: null,
    recipientCity: "Austin",
    recipientState: "TX",
    recipientZip: "78701",
    recipientCountry: "US",
    recipientEmail: "jane@example.com",
    recipientPhone: null,
    portrait: {
      printReadyKey: "portraits/o/p/print.png",
    },
    ...orderOverrides,
  };

  let createCalls = 0;
  let confirmCalls = 0;

  const deps: SubmitPaidPrintOrderDeps = {
    prisma: {
      printOrder: {
        async findUnique() {
          return { ...state, portrait: { ...state.portrait } };
        },
        async update({ data }) {
          Object.assign(state, data);
          state.updatedAt = new Date(state.updatedAt.getTime() + 1000);
          return { ...state, portrait: { ...state.portrait } };
        },
        async updateMany({ where, data }) {
          const statusFilters = Array.isArray(where.OR) ? where.OR : [];
          const allowedByStatus = statusFilters.some((filter) => {
            if (filter.status?.in) {
              return filter.status.in.includes(state.status);
            }

            if (filter.status === "SUBMITTING" && state.status === "SUBMITTING" && filter.updatedAt?.lt) {
              return state.updatedAt < filter.updatedAt.lt;
            }

            return false;
          });
          const paymentMatches = "stripePaymentId" in where ? where.stripePaymentId === state.stripePaymentId : true;
          if (where.id !== state.id || !allowedByStatus || !paymentMatches) {
            return { count: 0 };
          }

          Object.assign(state, data);
          state.updatedAt = new Date(state.updatedAt.getTime() + 1000);
          return { count: 1 };
        },
      },
    },
    isPrintfulConfigured: () => true,
    getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    async createPrintfulOrder() {
      createCalls += 1;
      return {
        id: 9001,
        external_id: "sahm_print_po_123",
        status: "draft",
        shipping: "STANDARD",
        costs: { subtotal: "31.95", shipping: "9.99", tax: "3.20", total: "45.14" },
      };
    },
    async confirmPrintfulOrder() {
      confirmCalls += 1;
      return { id: 9001, status: "pending" };
    },
    now: () => new Date("2026-04-03T10:00:00.000Z"),
  };

  return {
    state,
    deps,
    getCreateCalls: () => createCalls,
    getConfirmCalls: () => confirmCalls,
  };
}

describe("submitPaidPrintOrder", () => {
  it("submits once and ignores duplicate payment retries after success", async () => {
    const { state, deps, getCreateCalls, getConfirmCalls } = createDeps();

    await submitPaidPrintOrder(state.id, "pi_1", "cs_1", deps);
    await submitPaidPrintOrder(state.id, "pi_1", "cs_1", deps);

    assert.equal(getCreateCalls(), 1);
    assert.equal(getConfirmCalls(), 1);
    assert.equal(state.status, "SUBMITTED");
    assert.equal(state.printfulOrderId, 9001);
    assert.equal(state.printfulCost, 4514);
  });

  it("retries confirmation without creating a second Printful draft", async () => {
    const { state, deps, getCreateCalls, getConfirmCalls } = createDeps({
      status: "FAILED",
      stripePaymentId: "pi_1",
      stripeSessionId: "cs_1",
      printfulOrderId: 9001,
      printfulStatus: "confirmation_error",
    });

    await submitPaidPrintOrder(state.id, "pi_1", "cs_1", deps);

    assert.equal(getCreateCalls(), 0);
    assert.equal(getConfirmCalls(), 1);
    assert.equal(state.status, "SUBMITTED");
  });

  it("reclaims a stale submitting lock", async () => {
    const staleUpdatedAt = new Date(Date.parse("2026-04-03T10:00:00.000Z") - PRINT_ORDER_SUBMITTING_STALE_MS - 1000);
    const { state, deps, getCreateCalls, getConfirmCalls } = createDeps({
      status: "SUBMITTING",
      updatedAt: staleUpdatedAt,
      stripePaymentId: "pi_1",
      stripeSessionId: "cs_1",
    });

    await submitPaidPrintOrder(state.id, "pi_1", "cs_1", deps);

    assert.equal(getCreateCalls(), 1);
    assert.equal(getConfirmCalls(), 1);
    assert.equal(state.status, "SUBMITTED");
  });
});

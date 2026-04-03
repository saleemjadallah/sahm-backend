type PrintOrderSubmissionStatus =
  | "PENDING"
  | "PAID"
  | "SUBMITTING"
  | "SUBMITTED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "FAILED"
  | "CANCELED";

const SUBMISSION_FINAL_STATUSES = new Set<PrintOrderSubmissionStatus>([
  "SUBMITTED",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
]);

export const PRINT_ORDER_SUBMITTING_STALE_MS = 10 * 60 * 1000;

type PrintOrderRecord = {
  id: string;
  status: PrintOrderSubmissionStatus;
  updatedAt: Date;
  printfulOrderId: number | null;
  printfulStatus: string | null;
  printfulVariantId: number;
  printfulCost: number;
  stripePaymentId: string | null;
  stripeSessionId: string | null;
  recipientName: string;
  recipientAddress1: string;
  recipientAddress2: string | null;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  recipientCountry: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  portrait: {
    printReadyKey: string | null;
  };
};

type PrintOrderPrisma = {
  printOrder: {
    findUnique(args: {
      where: { id: string };
      include: { portrait: true };
    }): Promise<PrintOrderRecord | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<PrintOrderRecord>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
};

export type SubmitPaidPrintOrderDeps = {
  prisma: PrintOrderPrisma;
  isPrintfulConfigured: () => boolean;
  getPublicUrl: (key: string) => string;
  createPrintfulOrder: (order: {
    external_id: string;
    shipping: string;
    recipient: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state_code: string;
      country_code: string;
      zip: string;
      email?: string;
      phone?: string;
    };
    items: Array<{
      variant_id: number;
      quantity: number;
      files: Array<{ type: string; url: string }>;
    }>;
    packing_slip?: {
      store_name?: string;
      message?: string;
      email?: string;
    };
  }) => Promise<{
    id: number;
    status: string;
    costs?: {
      total?: string;
    };
  }>;
  confirmPrintfulOrder: (printfulOrderId: number) => Promise<{
    id: number;
    status: string;
  }>;
  now: () => Date;
};

async function getDefaultDeps(): Promise<SubmitPaidPrintOrderDeps> {
  const [{ prisma }, storageModule, printfulModule] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/storage.js"),
    import("./printful.js"),
  ]);

  return {
    prisma: {
      printOrder: {
        findUnique(args) {
          return prisma.printOrder.findUnique(args);
        },
        async update({ where, data }) {
          await prisma.printOrder.update({ where, data });
          const updated = await prisma.printOrder.findUnique({
            where,
            include: { portrait: true },
          });
          if (!updated) {
            throw new Error(`Print order ${where.id} was not found after update.`);
          }
          return updated;
        },
        updateMany(args) {
          return prisma.printOrder.updateMany(args);
        },
      },
    },
    isPrintfulConfigured: printfulModule.isPrintfulConfigured,
    getPublicUrl: storageModule.getPublicUrl,
    createPrintfulOrder: printfulModule.createOrder,
    confirmPrintfulOrder: printfulModule.confirmOrder,
    now: () => new Date(),
  };
}

function parseMoneyToCents(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

async function loadPrintOrder(id: string, deps: SubmitPaidPrintOrderDeps) {
  return deps.prisma.printOrder.findUnique({
    where: { id },
    include: { portrait: true },
  });
}

async function claimPrintOrderSubmission(
  current: PrintOrderRecord,
  paymentId: string | null,
  sessionId: string | null,
  deps: SubmitPaidPrintOrderDeps,
) {
  const staleBefore = new Date(deps.now().getTime() - PRINT_ORDER_SUBMITTING_STALE_MS);
  if (current.status === "SUBMITTING" && current.updatedAt >= staleBefore) {
    return null;
  }

  const paymentMatchCondition = current.stripePaymentId
    ? { stripePaymentId: current.stripePaymentId }
    : { stripePaymentId: null };

  const result = await deps.prisma.printOrder.updateMany({
    where: {
      id: current.id,
      ...paymentMatchCondition,
      OR: [
        { status: { in: ["PENDING", "PAID", "FAILED"] satisfies PrintOrderSubmissionStatus[] } },
        { status: "SUBMITTING", updatedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "SUBMITTING",
      printfulStatus: "submitting",
      ...(paymentId ? { stripePaymentId: paymentId } : {}),
      ...(sessionId ? { stripeSessionId: sessionId } : {}),
    },
  });

  if (result.count === 0) {
    return null;
  }

  return loadPrintOrder(current.id, deps);
}

export async function submitPaidPrintOrder(
  printOrderId: string,
  paymentId: string | null,
  sessionId: string | null,
  deps?: SubmitPaidPrintOrderDeps,
) {
  const resolvedDeps = deps ?? await getDefaultDeps();
  let current = await loadPrintOrder(printOrderId, resolvedDeps);
  if (!current) {
    return null;
  }

  if (current.stripePaymentId && paymentId && current.stripePaymentId !== paymentId) {
    return null;
  }

  const paymentUpdate: Record<string, unknown> = {};
  if (!current.stripePaymentId && paymentId) {
    paymentUpdate.stripePaymentId = paymentId;
  }
  if (sessionId && current.stripeSessionId !== sessionId) {
    paymentUpdate.stripeSessionId = sessionId;
  }
  if (current.status === "PENDING") {
    paymentUpdate.status = "PAID";
  }

  if (Object.keys(paymentUpdate).length > 0) {
    const updated = await resolvedDeps.prisma.printOrder.update({
      where: { id: current.id },
      data: paymentUpdate,
    });
    current = updated;
  }

  if (!resolvedDeps.isPrintfulConfigured() || !current.portrait.printReadyKey) {
    return current;
  }

  if (SUBMISSION_FINAL_STATUSES.has(current.status)) {
    return current;
  }

  const claimed = await claimPrintOrderSubmission(current, paymentId, sessionId, resolvedDeps);
  if (!claimed) {
    return loadPrintOrder(printOrderId, resolvedDeps);
  }

  let printfulOrderId = claimed.printfulOrderId;
  let confirmationStage = Boolean(printfulOrderId);

  try {
    if (!printfulOrderId) {
      const printReadyKey = claimed.portrait.printReadyKey;
      if (!printReadyKey) {
        throw new Error(`Print-ready file was missing for print order ${claimed.id}.`);
      }

      const created = await resolvedDeps.createPrintfulOrder({
        external_id: `sahm_print_${claimed.id}`,
        shipping: "STANDARD",
        recipient: {
          name: claimed.recipientName,
          address1: claimed.recipientAddress1,
          address2: claimed.recipientAddress2 ?? undefined,
          city: claimed.recipientCity,
          state_code: claimed.recipientState,
          country_code: claimed.recipientCountry,
          zip: claimed.recipientZip,
          email: claimed.recipientEmail ?? undefined,
          phone: claimed.recipientPhone ?? undefined,
        },
        items: [
          {
            variant_id: claimed.printfulVariantId,
            quantity: 1,
            files: [{ type: "default", url: resolvedDeps.getPublicUrl(printReadyKey) }],
          },
        ],
        packing_slip: {
          store_name: "Sahm",
          message: "A memorial portrait crafted with love",
        },
      });

      printfulOrderId = created.id;
      confirmationStage = true;

      await resolvedDeps.prisma.printOrder.update({
        where: { id: claimed.id },
        data: {
          printfulOrderId,
          printfulStatus: created.status,
          printfulCost: parseMoneyToCents(created.costs?.total),
        },
      });
    }

    if (!printfulOrderId) {
      throw new Error(`Printful order ID was missing for print order ${claimed.id}.`);
    }

    const confirmed = await resolvedDeps.confirmPrintfulOrder(printfulOrderId);
    return resolvedDeps.prisma.printOrder.update({
      where: { id: claimed.id },
      data: {
        status: "SUBMITTED",
        printfulStatus: confirmed.status,
      },
    });
  } catch (error) {
    await resolvedDeps.prisma.printOrder.update({
      where: { id: claimed.id },
      data: {
        status: "FAILED",
        printfulStatus: confirmationStage ? "confirmation_error" : "submission_error",
      },
    });
    throw error;
  }
}

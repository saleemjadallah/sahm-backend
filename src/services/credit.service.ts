import { Prisma } from "@prisma/client";
import type { PrismaClient, CreditTransaction, CreditTxnType } from "@prisma/client";
import { InsufficientCreditsError } from "../errors/index.js";

type CreditDbClient = PrismaClient | Prisma.TransactionClient;

function isUniqueConstraintError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Get current credit balance for a user.
 * Creates a CreditBalance record if one doesn't exist (new user).
 */
export async function getBalance(
  prisma: PrismaClient,
  userId: string,
): Promise<{ balance: number; lifetimeEarned: number; lifetimeSpent: number }> {
  const bal = await prisma.creditBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
  });
  return {
    balance: bal.balance,
    lifetimeEarned: bal.lifetimeEarned,
    lifetimeSpent: bal.lifetimeSpent,
  };
}

/**
 * Debit credits from a user's balance. Throws InsufficientCreditsError if not enough.
 * All operations are atomic via Prisma transaction.
 */
export async function debitCredits(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  type: CreditTxnType,
  referenceId?: string,
  description?: string,
): Promise<CreditTransaction> {
  return prisma.$transaction((tx) =>
    debitCreditsInTransaction(tx, userId, amount, type, referenceId, description),
  );
}

export async function debitCreditsInTransaction(
  prisma: Prisma.TransactionClient,
  userId: string,
  amount: number,
  type: CreditTxnType,
  referenceId?: string,
  description?: string,
): Promise<CreditTransaction> {
  return debitCreditsInternal(prisma, userId, amount, type, referenceId, description);
}

/**
 * Credit (add) credits to a user's balance.
 */
export async function creditCredits(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  type: CreditTxnType,
  referenceId?: string,
  description?: string,
): Promise<CreditTransaction> {
  return prisma.$transaction((tx) =>
    creditCreditsInternal(tx, userId, amount, type, referenceId, description),
  );
}

/**
 * Refund credits for a failed generation.
 */
export async function refundCredits(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  generationId: string,
): Promise<CreditTransaction> {
  return creditCredits(
    prisma,
    userId,
    amount,
    "REFUND",
    undefined,
    `Refund for failed generation ${generationId}`,
  );
}

/**
 * Get paginated credit transaction history for a user.
 */
export async function getTransactions(
  prisma: PrismaClient,
  userId: string,
  page = 1,
  limit = 20,
): Promise<{ transactions: CreditTransaction[]; total: number }> {
  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditTransaction.count({ where: { userId } }),
  ]);

  return { transactions, total };
}

async function debitCreditsInternal(
  prisma: CreditDbClient,
  userId: string,
  amount: number,
  type: CreditTxnType,
  referenceId?: string,
  description?: string,
): Promise<CreditTransaction> {
  const bal = await prisma.creditBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
  });

  if (bal.balance < amount) {
    throw new InsufficientCreditsError(amount, bal.balance);
  }

  const newBalance = bal.balance - amount;

  await prisma.creditBalance.update({
    where: { userId },
    data: {
      balance: newBalance,
      lifetimeSpent: { increment: amount },
    },
  });

  return prisma.creditTransaction.create({
    data: {
      userId,
      type,
      amount: -amount,
      balance: newBalance,
      generationId: type === "GENERATION" ? referenceId : undefined,
      packId: type === "PACK_GENERATION" ? referenceId : undefined,
      description: description || `Spent ${amount} credit(s)`,
    },
  });
}

async function creditCreditsInternal(
  prisma: CreditDbClient,
  userId: string,
  amount: number,
  type: CreditTxnType,
  referenceId?: string,
  description?: string,
): Promise<CreditTransaction> {
  if (referenceId && (type === "PURCHASE" || type === "SUBSCRIPTION")) {
    const existingTxn = await prisma.creditTransaction.findFirst({
      where: {
        userId,
        type,
        stripePaymentId: referenceId,
      },
    });

    if (existingTxn) {
      return existingTxn;
    }
  }

  const existing = await prisma.creditBalance.findUnique({ where: { userId } });
  const oldBalance = existing?.balance ?? 0;
  const newBalance = oldBalance + amount;

  await prisma.creditBalance.upsert({
    where: { userId },
    update: {
      balance: newBalance,
      lifetimeEarned: { increment: amount },
    },
    create: {
      userId,
      balance: amount,
      lifetimeEarned: amount,
      lifetimeSpent: 0,
    },
  });

  try {
    return await prisma.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balance: newBalance,
        stripePaymentId:
          type === "PURCHASE" || type === "SUBSCRIPTION" ? referenceId : undefined,
        description: description || `Added ${amount} credit(s)`,
      },
    });
  } catch (err) {
    if (
      referenceId
      && (type === "PURCHASE" || type === "SUBSCRIPTION")
      && isUniqueConstraintError(err)
    ) {
      const existingTxn = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type,
          stripePaymentId: referenceId,
        },
      });

      if (existingTxn) {
        return existingTxn;
      }
    }

    throw err;
  }
}

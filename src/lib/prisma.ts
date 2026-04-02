import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __sahmPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__sahmPrisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__sahmPrisma = prisma;
}

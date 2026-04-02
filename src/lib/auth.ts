import { createClerkClient, verifyToken } from "@clerk/backend";
import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import { env, isProduction } from "../config/env.js";

export type AuthUser = {
  id: string;
  email: string;
  clerkId: string;
  name: string | null;
};

const clerkClient = env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
  : null;

function getBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

async function upsertUserFromHeaders(
  clerkId: string,
  email: string | undefined,
  name: string | null | undefined,
) {
  if (!email) {
    const existing = await prisma.user.findUnique({ where: { clerkId } });
    if (existing) {
      return existing;
    }
  }

  return prisma.user.upsert({
    where: { clerkId },
    update: {
      email: email ?? undefined,
      name: name ?? null,
    },
    create: {
      clerkId,
      email: email ?? `${clerkId}@example.local`,
      name: name ?? null,
    },
  });
}

export async function authenticateRequest(request: FastifyRequest): Promise<AuthUser | null> {
  const devEmail = request.headers["x-dev-user-email"];
  if (!isProduction && typeof devEmail === "string" && !env.CLERK_SECRET_KEY) {
    const devUser = await prisma.user.upsert({
      where: { clerkId: "dev-user" },
      update: { email: devEmail, name: "Local Tester" },
      create: { clerkId: "dev-user", email: devEmail, name: "Local Tester" },
    });

    return {
      id: devUser.id,
      email: devUser.email,
      clerkId: devUser.clerkId,
      name: devUser.name,
    };
  }

  const token = getBearerToken(request);
  if (!token || !env.CLERK_SECRET_KEY) {
    return null;
  }

  const session = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
  });

  const clerkId = typeof session.sub === "string" ? session.sub : null;
  if (!clerkId) {
    return null;
  }

  const headerEmail = request.headers["x-user-email"];
  const headerName = request.headers["x-user-name"];
  let email = typeof headerEmail === "string" ? headerEmail : undefined;
  let name: string | null | undefined = typeof headerName === "string" ? headerName : undefined;

  if ((!email || !name) && clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      email = email ?? clerkUser.emailAddresses[0]?.emailAddress;
      const first = clerkUser.firstName ?? "";
      const last = clerkUser.lastName ?? "";
      name = name ?? (`${first} ${last}`.trim() || null);
    } catch {
      // Ignore Clerk fetch failures and fall back to stored data.
    }
  }

  const user = await upsertUserFromHeaders(clerkId, email, name);
  return {
    id: user.id,
    email: user.email,
    clerkId: user.clerkId,
    name: user.name,
  };
}

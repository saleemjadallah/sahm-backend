import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { env } from "../config/env.js";
import type { JwtPayload, AuthUser } from "../types/index.js";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  locale: true,
} as const;

function buildAuthorizedParties(frontendUrl: string): string[] {
  const normalized = frontendUrl.replace(/\/+$/, "");
  const origins = new Set([normalized]);

  try {
    const url = new URL(normalized);
    const { protocol, hostname, port } = url;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    if (!isLocalhost) {
      const alternateHostname = hostname.startsWith("www.")
        ? hostname.slice(4)
        : `www.${hostname}`;
      const alternateOrigin = `${protocol}//${alternateHostname}${port ? `:${port}` : ""}`;
      origins.add(alternateOrigin);
    }
  } catch {
    // Ignore malformed values and trust the configured origin as-is.
  }

  return [...origins];
}

const clerkClient = env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
  : null;
const clerkAuthorizedParties = buildAuthorizedParties(env.FRONTEND_URL);

function toAuthUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
  };
}

function isLegacyJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.sub === "string" && typeof payload.email === "string";
}

async function authenticateLegacyJwt(
  fastify: FastifyInstance,
  token: string,
): Promise<AuthUser | undefined> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!isLegacyJwtPayload(payload)) return undefined;

    const user = await fastify.prisma.user.findUnique({
      where: { id: payload.sub },
      select: USER_SELECT,
    });

    return user ? toAuthUser(user) : undefined;
  } catch {
    return undefined;
  }
}

async function getClerkEmail(clerkUserId: string): Promise<string | null> {
  if (!clerkClient) return null;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );

  return primaryEmail?.emailAddress
    ?? clerkUser.emailAddresses[0]?.emailAddress
    ?? null;
}

function buildClerkDisplayName(clerkUser: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string | null {
  const fullName = [clerkUser.firstName, clerkUser.lastName]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  return fullName || clerkUser.username || null;
}

async function resolveLocalUserFromClerk(
  fastify: FastifyInstance,
  clerkUserId: string,
): Promise<AuthUser | undefined> {
  const existingByClerkId = await fastify.prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: USER_SELECT,
  });

  if (existingByClerkId) {
    return toAuthUser(existingByClerkId);
  }

  if (!clerkClient) {
    return undefined;
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = await getClerkEmail(clerkUserId);
  if (!email) {
    return undefined;
  }

  const name = buildClerkDisplayName(clerkUser);
  const locale = clerkUser.locale || "en";

  const existingByEmail = await fastify.prisma.user.findUnique({
    where: { email },
    select: USER_SELECT,
  });

  if (existingByEmail) {
    const linkedUser = await fastify.prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId: clerkUserId,
        name: existingByEmail.name || name,
        locale: existingByEmail.locale || locale,
      },
      select: USER_SELECT,
    });

    return toAuthUser(linkedUser);
  }

  const createdUser = await fastify.prisma.user.create({
    data: {
      clerkId: clerkUserId,
      email,
      name,
      locale,
    },
    select: USER_SELECT,
  });

  return toAuthUser(createdUser);
}

async function authenticateClerkToken(
  fastify: FastifyInstance,
  token: string,
): Promise<AuthUser | undefined> {
  if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) {
    return undefined;
  }

  try {
    const payload = await verifyToken(token, {
      ...(env.CLERK_SECRET_KEY ? { secretKey: env.CLERK_SECRET_KEY } : {}),
      ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
      authorizedParties: clerkAuthorizedParties,
    });

    if (!payload?.sub) {
      return undefined;
    }

    return await resolveLocalUserFromClerk(fastify, payload.sub);
  } catch {
    return undefined;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      request.user = undefined;
      return;
    }

    const token = authHeader.slice(7);

    const legacyUser = await authenticateLegacyJwt(fastify, token);
    if (legacyUser) {
      request.user = legacyUser;
      return;
    }

    const clerkUser = await authenticateClerkToken(fastify, token);
    request.user = clerkUser;
  }

  fastify.decorate("authenticate", authenticate);

  // Add authenticate as a preHandler to parse JWT on every request (optional)
  fastify.addHook("preHandler", authenticate);
}

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["prisma"],
});

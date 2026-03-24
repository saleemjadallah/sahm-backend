import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendMagicLink, verifyMagicLink } from "../../services/auth.service.js";

const sendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Token is required"),
});

export async function magicLinkRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /magic-link — send magic link email
  fastify.post("/magic-link", async (request, reply) => {
    const body = sendSchema.parse(request.body);

    await sendMagicLink(fastify.prisma, body.email);

    return reply.status(200).send({
      success: true,
      data: { message: "Magic link sent. Check your email." },
    });
  });

  // POST /verify — verify magic link token and return JWT pair
  fastify.post("/verify", async (request, reply) => {
    const body = verifySchema.parse(request.body);

    const result = await verifyMagicLink(fastify.prisma, body.email, body.token);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  });
}

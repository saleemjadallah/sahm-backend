import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleGoogleAuth } from "../../services/auth.service.js";
import { trackCompleteRegistration, getClientIp } from "../../lib/meta/capi.js";

const googleAuthSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

export async function googleAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /google — exchange Google ID token for JWT pair
  fastify.post("/google", async (request, reply) => {
    const body = googleAuthSchema.parse(request.body);

    const result = await handleGoogleAuth(fastify.prisma, body.idToken);

    trackCompleteRegistration({
      email: result.user.email,
      userId: result.user.id,
      ip: getClientIp(request),
      userAgent: request.headers["user-agent"],
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
  });
}

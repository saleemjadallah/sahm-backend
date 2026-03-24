import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { respondToRsvp } from "../../services/rsvp.service.js";
import type { ApiResponse } from "../../types/index.js";

const slugParamSchema = z.object({
  slug: z.string().min(1, "RSVP slug is required"),
});

const respondSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  nameAr: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  rsvpStatus: z.enum(["ATTENDING", "NOT_ATTENDING", "MAYBE"]),
  plusOnes: z.number().int().min(0).max(20).optional(),
  dietaryNotes: z.string().max(500).optional(),
});

export async function respondRoute(fastify: FastifyInstance) {
  // POST /api/rsvp/:slug/respond — submit an RSVP response (no auth required)
  fastify.post<{ Params: { slug: string } }>(
    "/:slug/respond",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = slugParamSchema.parse(request.params);
      const body = respondSchema.parse(request.body);

      const result = await respondToRsvp(fastify.prisma, slug, body);

      const response: ApiResponse<{ guestId: string; status: string }> = {
        success: true,
        data: result,
      };

      reply.status(201).send(response);
    },
  );
}

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getPublicRsvpPage } from "../../services/rsvp.service.js";
import type { ApiResponse, RsvpPublicResponse } from "../../types/index.js";

const slugParamSchema = z.object({
  slug: z.string().min(1, "RSVP slug is required"),
});

export async function publicPageRoute(fastify: FastifyInstance) {
  // GET /api/rsvp/:slug — get public RSVP page data (no auth required)
  fastify.get<{ Params: { slug: string } }>(
    "/:slug",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = slugParamSchema.parse(request.params);

      const data = await getPublicRsvpPage(fastify.prisma, slug);

      const response: ApiResponse<RsvpPublicResponse> = {
        success: true,
        data,
      };

      reply.send(response);
    },
  );
}

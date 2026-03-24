import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { getSignedUrl, buildDesignKey } from "../../lib/storage/r2-client.js";
import type { ApiResponse } from "../../types/index.js";

export async function downloadDesignRoute(fastify: FastifyInstance) {
  // POST /api/designs/:id/download — Get a signed download URL for a purchased design
  fastify.post<{ Params: { id: string } }>(
    "/:id/download",
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: designId } = request.params;
      const userId = request.user!.id;

      // Find the design and verify it belongs to the user
      const design = await fastify.prisma.design.findUnique({
        where: { id: designId },
        include: {
          project: { select: { id: true, userId: true } },
        },
      });

      if (!design || design.project.userId !== userId) {
        throw new NotFoundError("Design");
      }

      // Verify the user has purchased this design
      const download = await fastify.prisma.download.findFirst({
        where: {
          userId,
          designId,
        },
      });

      // Also check if user has an active unlimited subscription
      const subscription = await fastify.prisma.subscription.findUnique({
        where: { userId },
      });

      const hasUnlimited = subscription?.plan === "UNLIMITED" && subscription?.status === "active";
      const hasCredits = subscription && subscription.creditsRemaining > 0;

      if (!download && !hasUnlimited && !hasCredits) {
        throw new ForbiddenError(
          "You need to purchase this design or have an active subscription to download it.",
        );
      }

      // If using credits, deduct one
      if (!download && !hasUnlimited && hasCredits && subscription) {
        await fastify.prisma.subscription.update({
          where: { userId },
          data: { creditsRemaining: { decrement: 1 } },
        });

        // Create a download record for credit usage
        await fastify.prisma.download.create({
          data: {
            userId,
            designId,
            purchaseType: "CREDIT_PACK",
            amountAed: 0,
          },
        });
      }

      if (!design.fullUrl) {
        throw new NotFoundError("Full resolution image");
      }

      // Generate a signed URL for the full-resolution image (1 hour expiry)
      const fullKey = buildDesignKey(design.project.id, designId, "full");
      const signedUrl = await getSignedUrl(fullKey, 3600);

      // Mark as downloaded
      await fastify.prisma.design.update({
        where: { id: designId },
        data: { isDownloaded: true },
      });

      const response: ApiResponse<{ downloadUrl: string; expiresIn: number }> = {
        success: true,
        data: {
          downloadUrl: signedUrl,
          expiresIn: 3600,
        },
      };

      reply.send(response);
    },
  );
}

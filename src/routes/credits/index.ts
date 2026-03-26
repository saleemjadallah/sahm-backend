import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getBalance, getTransactions } from "../../services/credit.service.js";
import { createCreditCheckout } from "../../services/payment.service.js";
import { trackInitiateCheckout, getClientIp } from "../../lib/meta/capi.js";
import { CREDIT_PACKS, type CreditPackKey } from "../../config/constants.js";
import type { CreditPurchaseRequest } from "../../types/index.js";

export async function creditRoutes(fastify: FastifyInstance) {
  // GET /api/credits — get current balance
  fastify.get(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const balance = await getBalance(fastify.prisma, request.userId!);
      return reply.send({ success: true, data: balance });
    },
  );

  // GET /api/credits/transactions — list credit transactions
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    "/transactions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page || "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || "20", 10)));

      const { transactions, total } = await getTransactions(
        fastify.prisma,
        request.userId!,
        page,
        limit,
      );

      return reply.send({
        success: true,
        data: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balance: t.balance,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // POST /api/credits/purchase — create Stripe checkout for credit pack
  fastify.post<{ Body: CreditPurchaseRequest }>(
    "/purchase",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await createCreditCheckout(request.userId!, request.body);

      const pack = CREDIT_PACKS[request.body.packSize as CreditPackKey];
      if (pack && request.user) {
        trackInitiateCheckout({
          email: request.user.email,
          userId: request.userId!,
          ip: getClientIp(request),
          userAgent: request.headers["user-agent"],
          currency: "AED",
          value: pack.priceAed / 100,
          contentName: `${pack.credits} Credits`,
        });
      }

      return reply.send({ success: true, data: result });
    },
  );
}

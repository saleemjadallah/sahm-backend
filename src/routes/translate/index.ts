import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { autoTranslate, translateUIBatch } from "../../services/translation.service.js";
import type { ApiResponse } from "../../types/index.js";

const translateSchema = z.object({
  text: z.string().min(1).max(1000),
  fieldType: z.enum(["name", "phrase", "venue", "general"]),
  fromLang: z.string().min(2).max(5),
  toLangs: z.array(z.string().min(2).max(5)).min(1).max(3),
  context: z.string().max(200).optional(),
});

const translateUISchema = z.object({
  strings: z.record(z.string()),
  targetLang: z.enum(["ar", "hi"]),
});

export async function translateRoutes(fastify: FastifyInstance) {
  // POST /api/translate — translate or transliterate a single text
  fastify.post(
    "/",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = translateSchema.parse(request.body);

      const translations = await autoTranslate(
        fastify.prisma,
        body.text,
        body.fieldType,
        body.fromLang,
        body.toLangs,
        body.context,
      );

      const response: ApiResponse<Record<string, string>> = {
        success: true,
        data: translations,
      };

      reply.send(response);
    },
  );

  // POST /api/translate/ui — batch translate UI strings
  fastify.post(
    "/ui",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = translateUISchema.parse(request.body);

      const translated = await translateUIBatch(
        fastify.prisma,
        body.strings,
        body.targetLang,
      );

      const response: ApiResponse<Record<string, string>> = {
        success: true,
        data: translated,
      };

      reply.send(response);
    },
  );
}

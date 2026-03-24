import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  listGuests,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuestsFromCsv,
  generateBroadcastLinks,
} from "../../services/guest.service.js";
import type { ApiResponse } from "../../types/index.js";

// ─── Schemas ──────────────────────────────────────────

const projectIdParamSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

const guestIdParamSchema = z.object({
  projectId: z.string().min(1),
  guestId: z.string().min(1, "Guest ID is required"),
});

const createGuestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  nameAr: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  tableNumber: z.string().max(20).optional(),
});

const updateGuestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameAr: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  tableNumber: z.string().max(20).optional(),
  rsvpStatus: z.enum(["PENDING", "ATTENDING", "NOT_ATTENDING", "MAYBE"]).optional(),
  plusOnes: z.number().int().min(0).max(20).optional(),
  dietaryNotes: z.string().max(500).optional(),
});

const importCsvSchema = z.object({
  csv: z.string().min(1, "CSV content is required"),
});

const broadcastSchema = z.object({
  guestIds: z.array(z.string()).optional(),
  message: z.string().max(1000).optional(),
});

// ─── Routes ───────────────────────────────────────────

export async function guestRoutes(fastify: FastifyInstance) {
  // All guest routes require authentication
  fastify.addHook("preHandler", requireAuth);

  // GET /api/projects/:projectId/guests — list all guests
  fastify.get<{ Params: { projectId: string } }>(
    "/:projectId/guests",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;

      const guests = await listGuests(fastify.prisma, projectId, userId);

      const response: ApiResponse = {
        success: true,
        data: guests,
      };

      reply.send(response);
    },
  );

  // POST /api/projects/:projectId/guests — create a guest
  fastify.post<{ Params: { projectId: string } }>(
    "/:projectId/guests",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;
      const body = createGuestSchema.parse(request.body);

      const guest = await createGuest(fastify.prisma, projectId, userId, body);

      const response: ApiResponse = {
        success: true,
        data: guest,
      };

      reply.status(201).send(response);
    },
  );

  // PUT /api/projects/:projectId/guests/:guestId — update a guest
  fastify.put<{ Params: { projectId: string; guestId: string } }>(
    "/:projectId/guests/:guestId",
    async (
      request: FastifyRequest<{ Params: { projectId: string; guestId: string } }>,
      reply: FastifyReply,
    ) => {
      const { guestId } = guestIdParamSchema.parse(request.params);
      const userId = request.user!.id;
      const body = updateGuestSchema.parse(request.body);

      const guest = await updateGuest(fastify.prisma, guestId, userId, body);

      const response: ApiResponse = {
        success: true,
        data: guest,
      };

      reply.send(response);
    },
  );

  // DELETE /api/projects/:projectId/guests/:guestId — delete a guest
  fastify.delete<{ Params: { projectId: string; guestId: string } }>(
    "/:projectId/guests/:guestId",
    async (
      request: FastifyRequest<{ Params: { projectId: string; guestId: string } }>,
      reply: FastifyReply,
    ) => {
      const { guestId } = guestIdParamSchema.parse(request.params);
      const userId = request.user!.id;

      await deleteGuest(fastify.prisma, guestId, userId);

      const response: ApiResponse = {
        success: true,
        data: { deleted: true },
      };

      reply.send(response);
    },
  );

  // POST /api/projects/:projectId/guests/import — import guests from CSV
  fastify.post<{ Params: { projectId: string } }>(
    "/:projectId/guests/import",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;
      const body = importCsvSchema.parse(request.body);

      const result = await importGuestsFromCsv(
        fastify.prisma,
        projectId,
        userId,
        body.csv,
      );

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      reply.send(response);
    },
  );

  // POST /api/projects/:projectId/guests/broadcast — generate WhatsApp broadcast links
  fastify.post<{ Params: { projectId: string } }>(
    "/:projectId/guests/broadcast",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = projectIdParamSchema.parse(request.params);
      const userId = request.user!.id;
      const body = broadcastSchema.parse(request.body || {});

      const links = await generateBroadcastLinks(
        fastify.prisma,
        projectId,
        userId,
        body.guestIds,
        body.message,
      );

      const response: ApiResponse = {
        success: true,
        data: links,
      };

      reply.send(response);
    },
  );
}

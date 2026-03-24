import type { PrismaClient, Guest } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { env } from "../config/env.js";
import type {
  CreateGuestRequest,
  UpdateGuestRequest,
  GuestImportResult,
  BroadcastLink,
} from "../types/index.js";

// ─── CRUD ──────────────────────────────────────────────

/**
 * List all guests for a project.
 */
export async function listGuests(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
): Promise<Guest[]> {
  // Verify project ownership
  await verifyProjectOwnership(prisma, projectId, userId);

  return prisma.guest.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a single guest.
 */
export async function createGuest(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  data: CreateGuestRequest,
): Promise<Guest> {
  await verifyProjectOwnership(prisma, projectId, userId);

  return prisma.guest.create({
    data: {
      projectId,
      name: data.name,
      nameAr: data.nameAr,
      phone: data.phone,
      email: data.email,
      tableNumber: data.tableNumber,
    },
  });
}

/**
 * Update a guest.
 */
export async function updateGuest(
  prisma: PrismaClient,
  guestId: string,
  userId: string,
  data: UpdateGuestRequest,
): Promise<Guest> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { project: { select: { userId: true } } },
  });

  if (!guest) {
    throw new NotFoundError("Guest");
  }
  if (guest.project.userId !== userId) {
    throw new NotFoundError("Guest");
  }

  return prisma.guest.update({
    where: { id: guestId },
    data: {
      name: data.name,
      nameAr: data.nameAr,
      phone: data.phone,
      email: data.email,
      tableNumber: data.tableNumber,
      rsvpStatus: data.rsvpStatus,
      plusOnes: data.plusOnes,
      dietaryNotes: data.dietaryNotes,
    },
  });
}

/**
 * Delete a guest.
 */
export async function deleteGuest(
  prisma: PrismaClient,
  guestId: string,
  userId: string,
): Promise<void> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { project: { select: { userId: true } } },
  });

  if (!guest) {
    throw new NotFoundError("Guest");
  }
  if (guest.project.userId !== userId) {
    throw new NotFoundError("Guest");
  }

  await prisma.guest.delete({ where: { id: guestId } });
}

// ─── CSV Import ────────────────────────────────────────

/**
 * Import guests from a CSV file.
 * Expected columns: name, name_ar (optional), phone (optional), email (optional), table_number (optional)
 */
export async function importGuestsFromCsv(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  csvContent: string,
): Promise<GuestImportResult> {
  await verifyProjectOwnership(prisma, projectId, userId);

  let records: Array<Record<string, string>>;

  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    throw new ValidationError("Invalid CSV format");
  }

  const result: GuestImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // 1-indexed + header row

    const name = row.name || row.Name || row.NAME;
    if (!name) {
      result.errors.push(`Row ${rowNum}: Missing name`);
      result.skipped++;
      continue;
    }

    try {
      await prisma.guest.create({
        data: {
          projectId,
          name,
          nameAr: row.name_ar || row.nameAr || row["Name (Arabic)"] || undefined,
          phone: row.phone || row.Phone || row.PHONE || undefined,
          email: row.email || row.Email || row.EMAIL || undefined,
          tableNumber: row.table_number || row.tableNumber || row["Table Number"] || undefined,
        },
      });
      result.imported++;
    } catch (err) {
      result.errors.push(
        `Row ${rowNum}: Failed to import "${name}" - ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      result.skipped++;
    }
  }

  return result;
}

// ─── WhatsApp Broadcast Links ──────────────────────────

/**
 * Generate WhatsApp deep links for sending RSVP invitations to guests.
 * Uses wa.me deep links (MVP) — can be upgraded to WhatsApp Cloud API in Phase 2.
 */
export async function generateBroadcastLinks(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  guestIds?: string[],
  customMessage?: string,
): Promise<BroadcastLink[]> {
  await verifyProjectOwnership(prisma, projectId, userId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { rsvpSlug: true, title: true, nameEn: true },
  });

  if (!project?.rsvpSlug) {
    throw new ValidationError("Project does not have an RSVP page. Purchase the RSVP tier to enable this feature.");
  }

  const where = guestIds && guestIds.length > 0
    ? { projectId, id: { in: guestIds } }
    : { projectId, rsvpStatus: "PENDING" as const };

  const guests = await prisma.guest.findMany({ where });

  const rsvpUrl = `${env.FRONTEND_URL}/rsvp/${project.rsvpSlug}`;
  const eventName = project.nameEn || project.title || "our celebration";

  const links: BroadcastLink[] = guests
    .filter((g) => g.phone)
    .map((guest) => {
      const message =
        customMessage ||
        `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645 ${guest.name} \ud83c\udf38\n\nYou are warmly invited to ${eventName}!\n\n\u062a\u062a\u0634\u0631\u0641 \u0628\u062f\u0639\u0648\u062a\u0643\u0645 \u0644\u062d\u0636\u0648\u0631\n\nRSVP here: ${rsvpUrl}\n\n\u0633\u0647\u0645 Sahm`;

      const encodedMessage = encodeURIComponent(message);
      const phone = guest.phone!.replace(/[^0-9+]/g, "").replace(/^\+/, "");

      return {
        guestId: guest.id,
        guestName: guest.name,
        whatsappUrl: `https://wa.me/${phone}?text=${encodedMessage}`,
      };
    });

  // Mark invites as sent
  const now = new Date();
  await prisma.guest.updateMany({
    where: { id: { in: links.map((l) => l.guestId) } },
    data: { inviteSentAt: now },
  });

  return links;
}

// ─── Helpers ───────────────────────────────────────────

async function verifyProjectOwnership(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }
}

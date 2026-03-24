import type { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "../errors/index.js";
import { sendRsvpNotification } from "./email.service.js";
import type { RsvpPublicResponse, RsvpRespondRequest, DesignResponse } from "../types/index.js";

/**
 * Get the public RSVP page data for a given slug.
 */
export async function getPublicRsvpPage(
  prisma: PrismaClient,
  slug: string,
): Promise<RsvpPublicResponse> {
  const project = await prisma.project.findUnique({
    where: { rsvpSlug: slug },
    include: {
      designs: {
        where: {
          designType: "WEDDING_INVITATION",
          generationStatus: "COMPLETED",
        },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("RSVP page");
  }

  const invitationDesign = project.designs[0]
    ? formatDesignResponse(project.designs[0])
    : null;

  return {
    projectTitle: project.title,
    nameEn: project.nameEn,
    nameAr: project.nameAr,
    date: project.date?.toISOString() || null,
    dateHijri: project.dateHijri,
    metadata: project.metadata as RsvpPublicResponse["metadata"],
    invitationDesign,
  };
}

/**
 * Record an RSVP response for a given slug.
 */
export async function respondToRsvp(
  prisma: PrismaClient,
  slug: string,
  body: RsvpRespondRequest,
): Promise<{ guestId: string; status: string }> {
  const project = await prisma.project.findUnique({
    where: { rsvpSlug: slug },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!project) {
    throw new NotFoundError("RSVP page");
  }

  // Check if guest already exists by phone or email
  let existingGuest = null;
  if (body.phone) {
    existingGuest = await prisma.guest.findFirst({
      where: { projectId: project.id, phone: body.phone },
    });
  }
  if (!existingGuest && body.email) {
    existingGuest = await prisma.guest.findFirst({
      where: { projectId: project.id, email: body.email },
    });
  }

  let guest;

  if (existingGuest) {
    // Update existing guest RSVP
    guest = await prisma.guest.update({
      where: { id: existingGuest.id },
      data: {
        name: body.name,
        nameAr: body.nameAr,
        phone: body.phone,
        email: body.email,
        rsvpStatus: body.rsvpStatus,
        rsvpAt: new Date(),
        plusOnes: body.plusOnes ?? 0,
        dietaryNotes: body.dietaryNotes,
      },
    });
  } else {
    // Create new guest record with RSVP
    guest = await prisma.guest.create({
      data: {
        projectId: project.id,
        name: body.name,
        nameAr: body.nameAr,
        phone: body.phone,
        email: body.email,
        rsvpStatus: body.rsvpStatus,
        rsvpAt: new Date(),
        plusOnes: body.plusOnes ?? 0,
        dietaryNotes: body.dietaryNotes,
      },
    });
  }

  // Notify the project owner
  if (project.user.email) {
    await sendRsvpNotification(
      project.user.email,
      body.name,
      body.rsvpStatus,
      project.title || "Wedding",
    );
  }

  return {
    guestId: guest.id,
    status: guest.rsvpStatus,
  };
}

/**
 * Get RSVP statistics for a project.
 */
export async function getRsvpStats(
  prisma: PrismaClient,
  projectId: string,
): Promise<{
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
  pending: number;
  totalPlusOnes: number;
}> {
  const [stats, plusOnesResult] = await Promise.all([
    prisma.guest.groupBy({
      by: ["rsvpStatus"],
      where: { projectId },
      _count: true,
    }),
    prisma.guest.aggregate({
      where: { projectId },
      _sum: { plusOnes: true },
      _count: true,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    stats.map((s) => [s.rsvpStatus, s._count]),
  );

  return {
    total: plusOnesResult._count,
    attending: statusCounts.ATTENDING || 0,
    notAttending: statusCounts.NOT_ATTENDING || 0,
    maybe: statusCounts.MAYBE || 0,
    pending: statusCounts.PENDING || 0,
    totalPlusOnes: plusOnesResult._sum.plusOnes || 0,
  };
}

// ─── Helper ────────────────────────────────────────────

function formatDesignResponse(design: {
  id: string;
  projectId: string;
  designType: string;
  style: string | null;
  previewUrl: string;
  fullUrl: string | null;
  aspectRatio: string;
  generationStatus: string;
  textContent: unknown;
  isDownloaded: boolean;
  createdAt: Date;
}): DesignResponse {
  return {
    id: design.id,
    projectId: design.projectId,
    designType: design.designType as DesignResponse["designType"],
    style: design.style,
    previewUrl: design.previewUrl,
    fullUrl: design.fullUrl,
    aspectRatio: design.aspectRatio,
    generationStatus: design.generationStatus as DesignResponse["generationStatus"],
    textContent: design.textContent as DesignResponse["textContent"],
    isDownloaded: design.isDownloaded,
    createdAt: design.createdAt.toISOString(),
  };
}

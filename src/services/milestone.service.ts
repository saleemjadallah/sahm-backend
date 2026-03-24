import type { PrismaClient, MilestoneType } from "@prisma/client";
import dayjs from "dayjs";
import { MILESTONE_OFFSETS } from "../config/constants.js";
import { NotFoundError } from "../errors/index.js";
import { sendMilestoneReminder } from "./email.service.js";
import { regenerateDesign } from "./design.service.js";

// ─── Milestone Labels ──────────────────────────────────

const MILESTONE_LABELS: Record<string, { en: string; ar: string }> = {
  DAY_7: { en: "7 Days Old", ar: "\u0667 \u0623\u064a\u0627\u0645" },
  DAY_40: { en: "40 Days Old", ar: "\u0664\u0660 \u064a\u0648\u0645" },
  MONTH_1: { en: "1 Month Old", ar: "\u0634\u0647\u0631 \u0648\u0627\u062d\u062f" },
  MONTH_2: { en: "2 Months Old", ar: "\u0634\u0647\u0631\u064a\u0646" },
  MONTH_3: { en: "3 Months Old", ar: "\u0663 \u0623\u0634\u0647\u0631" },
  MONTH_6: { en: "6 Months Old", ar: "\u0666 \u0623\u0634\u0647\u0631" },
  MONTH_9: { en: "9 Months Old", ar: "\u0669 \u0623\u0634\u0647\u0631" },
  YEAR_1: { en: "1 Year Old!", ar: "\u0633\u0646\u0629 \u0623\u0648\u0644\u0649!" },
  FIRST_RAMADAN: { en: "First Ramadan", ar: "\u0623\u0648\u0644 \u0631\u0645\u0636\u0627\u0646" },
  FIRST_EID: { en: "First Eid", ar: "\u0623\u0648\u0644 \u0639\u064a\u062f" },
};

// ─── Schedule Milestones ───────────────────────────────

/**
 * Create milestone records for a baby project.
 * Called after a Baby Journey purchase.
 */
export async function scheduleMilestones(
  prisma: PrismaClient,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.type !== "BABY" || !project.date) {
    throw new NotFoundError("Baby project with birth date");
  }

  const birthDate = dayjs(project.date);
  const milestones: Array<{ type: MilestoneType; triggerDate: Date }> = [];

  for (const [type, days] of Object.entries(MILESTONE_OFFSETS)) {
    if (days === null) {
      // FIRST_RAMADAN and FIRST_EID — approximate for now
      // A proper implementation would use Hijri calendar calculation
      if (type === "FIRST_RAMADAN") {
        // Approximate: Ramadan shifts ~11 days earlier each Gregorian year
        // For MVP, schedule roughly 6 months after birth as a placeholder
        milestones.push({
          type: type as MilestoneType,
          triggerDate: birthDate.add(180, "day").toDate(),
        });
      } else if (type === "FIRST_EID") {
        // Schedule roughly 7 months after birth as a placeholder
        milestones.push({
          type: type as MilestoneType,
          triggerDate: birthDate.add(210, "day").toDate(),
        });
      }
    } else {
      milestones.push({
        type: type as MilestoneType,
        triggerDate: birthDate.add(days, "day").toDate(),
      });
    }
  }

  // Create all milestone records
  await prisma.milestone.createMany({
    data: milestones.map((m) => ({
      projectId,
      type: m.type,
      triggerDate: m.triggerDate,
    })),
    skipDuplicates: true,
  });
}

// ─── Process Due Milestones ────────────────────────────

/**
 * Find milestones that are due today (or overdue), generate their cards,
 * and send notification emails. This should be called by a cron job daily.
 */
export async function processDueMilestones(
  prisma: PrismaClient,
): Promise<number> {
  const now = new Date();

  const dueMilestones = await prisma.milestone.findMany({
    where: {
      isNotified: false,
      triggerDate: { lte: now },
    },
    include: {
      project: {
        include: {
          user: { select: { email: true } },
        },
      },
    },
    take: 50, // Process in batches
  });

  let processed = 0;

  for (const milestone of dueMilestones) {
    try {
      const project = milestone.project;
      const metadata = project.metadata as Record<string, unknown> | null;
      const babyName = (metadata?.babyNameEn as string) || project.nameEn || "Baby";
      const label = MILESTONE_LABELS[milestone.type]?.en || milestone.type;

      // Auto-generate a milestone card design
      const milestoneDesign = await prisma.design.create({
        data: {
          projectId: project.id,
          designType: "BABY_MILESTONE_CARD",
          style: (metadata?.style as string) || "celestial",
          previewUrl: "",
          aspectRatio: "1:1",
          generationStatus: "PENDING",
          textContent: {
            babyName: {
              en: babyName,
              ar: (metadata?.babyNameAr as string) || project.nameAr || "",
            },
            milestone: {
              en: label,
              ar: MILESTONE_LABELS[milestone.type]?.ar || "",
            },
          },
        },
      });

      // Generate the design (will be watermarked)
      try {
        await regenerateDesign(prisma, milestoneDesign.id);
      } catch {
        // Design generation may fail — continue processing other milestones
      }

      // Update milestone with designId and mark as notified
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: {
          designId: milestoneDesign.id,
          isNotified: true,
        },
      });

      // Send notification email
      if (project.user.email) {
        await sendMilestoneReminder(
          project.user.email,
          babyName,
          label,
          project.id,
        );
      }

      processed++;
    } catch (err) {
      // Log error but continue with other milestones
      console.error(
        `Failed to process milestone ${milestone.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return processed;
}

/**
 * Get all milestones for a project.
 */
export async function getProjectMilestones(
  prisma: PrismaClient,
  projectId: string,
) {
  return prisma.milestone.findMany({
    where: { projectId },
    orderBy: { triggerDate: "asc" },
  });
}

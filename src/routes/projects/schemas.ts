import { z } from "zod";

export const createProjectSchema = z.object({
  type: z.enum(["WEDDING", "BABY", "WALL_ART", "GIFT"]),
  title: z.string().max(200).optional(),
  nameEn: z.string().max(200).optional(),
  nameAr: z.string().max(200).optional(),
  nameHi: z.string().max(200).optional(),
  date: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  dateHijri: z.string().max(50).optional(),
  languages: z.array(z.enum(["en", "ar", "hi"])).min(1).default(["en"]),
  style: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().max(200).optional(),
  nameEn: z.string().max(200).optional(),
  nameAr: z.string().max(200).optional(),
  nameHi: z.string().max(200).optional(),
  date: z.string().optional(),
  dateHijri: z.string().max(50).optional(),
  languages: z.array(z.enum(["en", "ar", "hi"])).min(1).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  type: z.enum(["WEDDING", "BABY", "WALL_ART", "GIFT"]).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;

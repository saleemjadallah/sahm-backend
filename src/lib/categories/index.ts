import type { PrismaClient, Category, Subcategory } from "@prisma/client";

export type CategoryWithSubs = Category & { subcategories: Subcategory[] };

// Simple in-memory cache (TTL: 5 minutes)
let cache: CategoryWithSubs[] | null = null;
let cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

function isFresh(): boolean {
  return cache !== null && Date.now() - cacheAt < CACHE_TTL;
}

export async function getAllCategories(
  prisma: PrismaClient,
): Promise<CategoryWithSubs[]> {
  if (isFresh()) return cache!;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  cache = categories;
  cacheAt = Date.now();
  return categories;
}

export async function getCategory(
  prisma: PrismaClient,
  categoryId: string,
): Promise<CategoryWithSubs | null> {
  const all = await getAllCategories(prisma);
  return all.find((c) => c.id === categoryId) ?? null;
}

export function invalidateCategoryCache(): void {
  cache = null;
  cacheAt = 0;
}

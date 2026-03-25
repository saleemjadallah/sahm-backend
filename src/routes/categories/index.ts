import type { FastifyInstance } from "fastify";
import { getAllCategories, getCategory } from "../../lib/categories/index.js";
import { NotFoundError } from "../../errors/index.js";
import type { CategoryResponse, SubcategoryResponse } from "../../types/index.js";

export async function categoryRoutes(fastify: FastifyInstance) {
  // GET /api/categories — list all active categories (public)
  fastify.get("/", async (request, reply) => {
    const categories = await getAllCategories(fastify.prisma);

    const data: CategoryResponse[] = categories.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      iconUrl: c.iconUrl,
      sortOrder: c.sortOrder,
      outputSpecs: c.outputSpecs as Record<string, unknown> | null,
      styleOptions: c.styleOptions as string[] | null,
      subcategories: c.subcategories.map(
        (s): SubcategoryResponse => ({
          id: s.id,
          label: s.label,
          description: s.description,
          defaultAspect: s.defaultAspect,
        }),
      ),
    }));

    return reply.send({ success: true, data });
  });

  // GET /api/categories/:id — get single category (public)
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const category = await getCategory(fastify.prisma, request.params.id);
    if (!category) throw new NotFoundError("Category");

    const data: CategoryResponse = {
      id: category.id,
      label: category.label,
      description: category.description,
      iconUrl: category.iconUrl,
      sortOrder: category.sortOrder,
      outputSpecs: category.outputSpecs as Record<string, unknown> | null,
      styleOptions: category.styleOptions as string[] | null,
      subcategories: category.subcategories.map(
        (s): SubcategoryResponse => ({
          id: s.id,
          label: s.label,
          description: s.description,
          defaultAspect: s.defaultAspect,
        }),
      ),
    };

    return reply.send({ success: true, data });
  });
}

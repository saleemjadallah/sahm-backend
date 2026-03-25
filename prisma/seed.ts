import { PrismaClient } from "@prisma/client";
import { CATEGORIES } from "../src/lib/categories/seed-data.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding categories...");

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        label: cat.label,
        description: cat.description,
        sortOrder: cat.sortOrder,
        promptConfig: cat.promptConfig,
        metadataSchema: cat.metadataSchema,
        outputSpecs: cat.outputSpecs,
        styleOptions: cat.styleOptions,
      },
      create: {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        sortOrder: cat.sortOrder,
        promptConfig: cat.promptConfig,
        metadataSchema: cat.metadataSchema,
        outputSpecs: cat.outputSpecs,
        styleOptions: cat.styleOptions,
      },
    });

    for (const sub of cat.subcategories) {
      await prisma.subcategory.upsert({
        where: { id: sub.id },
        update: {
          categoryId: cat.id,
          label: sub.label,
          description: sub.description,
          sortOrder: sub.sortOrder,
          promptTemplate: sub.promptTemplate,
          defaultAspect: sub.defaultAspect,
        },
        create: {
          id: sub.id,
          categoryId: cat.id,
          label: sub.label,
          description: sub.description,
          sortOrder: sub.sortOrder,
          promptTemplate: sub.promptTemplate,
          defaultAspect: sub.defaultAspect,
        },
      });
    }

    console.log(`  ✓ ${cat.label} (${cat.subcategories.length} subcategories)`);
  }

  console.log(`\nSeeded ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

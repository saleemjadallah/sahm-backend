import { PrismaClient, DiscountType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.promoCode.upsert({
    where: { code: "BMO" },
    update: {
      type: DiscountType.PERCENT,
      value: 15,
      description: "Launch partner offer",
      isActive: true,
    },
    create: {
      code: "BMO",
      type: DiscountType.PERCENT,
      value: 15,
      description: "Launch partner offer",
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

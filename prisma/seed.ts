/**
 * Seed script for Lumiere Belleza
 * Run: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD before running the seed script"
    );
  }

  const business = await prisma.business.upsert({
    where: { slug: "lumiere-belleza" },
    update: {},
    create: {
      name: "Lumiere Belleza",
      slug: "lumiere-belleza",
      description: "Original skincare & cosmetics in Abuja",
      whatsappPhoneNumber: "+2349041111160",
      timezone: "Africa/Lagos",
      currency: "NGN",
      address: "Shop C1, 09, River Park Estate Plaza, Lugbe Airport Road, Abuja",
      supportPhone: "+2349041111160",
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      businessId: business.id,
    },
  });

  console.log("Seeded business:", business.name);
  console.log("Seeded admin account:", adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

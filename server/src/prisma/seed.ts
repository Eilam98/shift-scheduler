import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

// Bootstraps the three departments, the default shift-time templates,
// and the FIRST restaurant manager account. There is no API route for
// creating a restaurant manager (see PROJECT_SPEC.md) — this seed script
// is the only way one ever gets created.
async function main() {
  const departmentNames = ["Waiters", "Hostesses", "Bar"];

  for (const name of departmentNames) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.shiftTemplate.upsert({
    where: { label: "MORNING" },
    update: {},
    create: { label: "MORNING", defaultStartTime: "08:00", defaultEndTime: "16:00" },
  });

  await prisma.shiftTemplate.upsert({
    where: { label: "EVENING" },
    update: {},
    create: { label: "EVENING", defaultStartTime: "16:00", defaultEndTime: "23:30" },
  });

  // CHANGE THESE before running in anything but local dev.
  const managerEmail = "manager@example.com";
  const managerTempPassword = "ChangeMe123";

  const existingManager = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!existingManager) {
    const passwordHash = await hashPassword(managerTempPassword);
    await prisma.user.create({
      data: {
        name: "Restaurant Manager",
        email: managerEmail,
        passwordHash,
        isRestaurantManager: true,
        requiresPasswordChange: true,
      },
    });
    console.log(`Created restaurant manager: ${managerEmail} / ${managerTempPassword}`);
    console.log("Log in and change this password immediately.");
  } else {
    console.log("Restaurant manager already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

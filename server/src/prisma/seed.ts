import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, isValidPassword } from "../lib/auth";

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

  // The manager's details come from server/.env (gitignored) so personal
  // info and the temporary password never end up in the repo.
  const managerName = process.env.SEED_MANAGER_NAME;
  const managerEmail = process.env.SEED_MANAGER_EMAIL?.trim().toLowerCase();
  const managerTempPassword = process.env.SEED_MANAGER_PASSWORD;

  if (!managerName || !managerEmail || !managerTempPassword) {
    throw new Error(
      "Set SEED_MANAGER_NAME, SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD in server/.env"
    );
  }
  if (!isValidPassword(managerTempPassword)) {
    throw new Error(
      "SEED_MANAGER_PASSWORD must be at least 8 characters and include a letter and a number"
    );
  }

  // Only one restaurant manager may exist (PROJECT_SPEC.md "Roles").
  const existingManager = await prisma.user.findFirst({ where: { isRestaurantManager: true } });
  if (!existingManager) {
    const passwordHash = await hashPassword(managerTempPassword);
    await prisma.user.create({
      data: {
        name: managerName,
        email: managerEmail,
        passwordHash,
        isRestaurantManager: true,
        requiresPasswordChange: true,
      },
    });
    console.log(`Created restaurant manager: ${managerEmail}`);
    console.log("You'll be asked to change the temporary password on first login.");
  } else {
    console.log(`Restaurant manager already exists (${existingManager.email}), skipping.`);
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

import "dotenv/config";
import { PayType, PrismaClient } from "@prisma/client";
import { hashPassword, isValidPassword } from "../lib/auth";

const prisma = new PrismaClient();

// Each department's pay type (PROJECT_SPEC.md "Departments & pay"). Amounts
// are left unset — the restaurant manager enters them on the Departments & pay page.
const departments: { name: string; payType: PayType }[] = [
  { name: "Waiters", payType: "TIPS" },
  { name: "Hostesses", payType: "FIXED" },
  { name: "Bar", payType: "TIPS" },
  { name: "Shift Managers", payType: "FIXED" },
];

// First pay rate row for every department, so a rate exists for any date we'll need.
const INITIAL_RATE_DATE = new Date(Date.UTC(2026, 0, 1));

// Bootstraps the departments with their initial pay type, the default
// shift-time templates, the restaurant settings row, and the FIRST restaurant
// manager account. There is no API route for creating a restaurant manager
// (see PROJECT_SPEC.md) — this seed script is the only way one ever gets created.
// Idempotent: existing rows are left as they are.
async function main() {
  for (const { name, payType } of departments) {
    const department = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    await prisma.departmentPayRate.upsert({
      where: {
        departmentId_effectiveFrom: {
          departmentId: department.id,
          effectiveFrom: INITIAL_RATE_DATE,
        },
      },
      update: {},
      create: { departmentId: department.id, effectiveFrom: INITIAL_RATE_DATE, payType },
    });
  }

  await prisma.restaurantSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

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

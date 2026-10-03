import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, isValidPassword } from "../lib/auth";
import { departmentRolesInclude, toDepartmentRoles } from "../lib/users";
import { hourlyDepartmentIds } from "../lib/pay";
import { generateUniquePin } from "../lib/pins";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

const router = Router();

// All routes here are restaurant-manager only, per PROJECT_SPEC.md
router.use(authenticate, requireRestaurantManager);

// Where a user works and what they manage — chosen independently.
const departmentRolesSchema = z.object({
  memberDepartmentIds: z.array(z.string().min(1)).default([]),
  managedDepartmentIds: z.array(z.string().min(1)).default([]),
  // Hourly bonus per department the user works in, agorot / hour (always added on top).
  bonuses: z.record(z.number().int().min(0).max(1_000_000)).optional(),
});

type DepartmentRoles = z.infer<typeof departmentRolesSchema>;
type RolesError = { status: number; error: string; code?: string; params?: Record<string, string> };

/**
 * Checks department roles against the domain rules before they touch the DB:
 * no duplicates, every departmentId exists, and each department to be managed
 * doesn't already have a manager other than this user (a department has at
 * most one manager). Returns the error to send, or null if valid.
 */
async function validateDepartmentRoles(
  { memberDepartmentIds, managedDepartmentIds }: DepartmentRoles,
  userId?: string
): Promise<RolesError | null> {
  if (
    new Set(memberDepartmentIds).size !== memberDepartmentIds.length ||
    new Set(managedDepartmentIds).size !== managedDepartmentIds.length
  ) {
    return { status: 400, error: "Each department can only be assigned once" };
  }

  const ids = new Set([...memberDepartmentIds, ...managedDepartmentIds]);
  const found = await prisma.department.count({ where: { id: { in: [...ids] } } });
  if (found !== ids.size) {
    return { status: 400, error: "One or more departmentIds do not exist" };
  }

  const taken = await prisma.departmentManager.findFirst({
    where: {
      departmentId: { in: managedDepartmentIds },
      ...(userId ? { userId: { not: userId } } : {}),
    },
    include: { user: true, department: true },
  });
  if (taken) {
    return {
      status: 409,
      error: `${taken.department.name} is already managed by ${taken.user.name}`,
      code: "DEPARTMENT_HAS_MANAGER",
      params: { department: taken.department.name, name: taken.user.name },
    };
  }

  return null;
}

/** `hourly` = departments that clock in (see lib/pay.ts). */
function toUserListItem(
  user: Prisma.UserGetPayload<{ include: typeof departmentRolesInclude }>,
  hourly: Set<string>
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isRestaurantManager: user.isRestaurantManager,
    isActive: user.isActive,
    hasPin: user.pinHash !== null,
    bonuses: Object.fromEntries(user.memberships.map((m) => [m.departmentId, m.hourlyBonus])),
    canClockIn: user.memberships.some((m) => hourly.has(m.departmentId)),
    ...toDepartmentRoles(user),
  };
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  temporaryPassword: z.string().min(1),
}).merge(departmentRolesSchema);

// POST /api/users — restaurant-manager only
router.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "name, email, temporaryPassword are required" });
  }
  const { name, email, temporaryPassword, memberDepartmentIds, managedDepartmentIds } = parsed.data;

  if (!isValidPassword(temporaryPassword)) {
    return res
      .status(400)
      .json({
        error: "Temporary password must be at least 8 characters and include a letter and a number",
        code: "INVALID_PASSWORD",
      });
  }

  const rolesError = await validateDepartmentRoles(parsed.data);
  if (rolesError) {
    const { status, ...body } = rolesError;
    return res.status(status).json(body);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists", code: "EMAIL_TAKEN" });
  }

  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      requiresPasswordChange: true,
      memberships: { create: memberDepartmentIds.map((departmentId) => ({ departmentId })) },
      managedDepartments: { create: managedDepartmentIds.map((departmentId) => ({ departmentId })) },
    },
    include: departmentRolesInclude,
  });

  return res.status(201).json(toUserListItem(user, await hourlyDepartmentIds()));
});

// GET /api/users — restaurant-manager only
router.get("/", async (_req, res) => {
  const [users, hourly] = await Promise.all([
    prisma.user.findMany({ include: departmentRolesInclude, orderBy: { name: "asc" } }),
    hourlyDepartmentIds(),
  ]);

  return res.status(200).json({ users: users.map((u) => toUserListItem(u, hourly)) });
});

// PATCH /api/users/:id/departments — restaurant-manager only, full replace of
// { memberDepartmentIds, managedDepartmentIds }.
router.patch("/:id/departments", async (req, res) => {
  const parsed = departmentRolesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "memberDepartmentIds and managedDepartmentIds must be arrays" });
  }
  const { id } = req.params;
  const { memberDepartmentIds, managedDepartmentIds, bonuses } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }
  if (existing.isRestaurantManager && managedDepartmentIds.length > 0) {
    return res.status(400).json({ error: "The restaurant manager already manages every department" });
  }

  const rolesError = await validateDepartmentRoles(parsed.data, id);
  if (rolesError) {
    const { status, ...body } = rolesError;
    return res.status(status).json(body);
  }

  // Memberships: remove the ones no longer listed and add new ones, but keep
  // existing rows so per-department data on them (hourlyBonus) survives.
  const user = await prisma.$transaction(async (tx) => {
    await tx.departmentMembership.deleteMany({
      where: { userId: id, departmentId: { notIn: memberDepartmentIds } },
    });
    await tx.departmentMembership.createMany({
      data: memberDepartmentIds.map((departmentId) => ({ userId: id, departmentId })),
      skipDuplicates: true,
    });

    for (const [departmentId, hourlyBonus] of Object.entries(bonuses ?? {})) {
      if (!memberDepartmentIds.includes(departmentId)) continue; // only where they work
      await tx.departmentMembership.update({
        where: { userId_departmentId: { userId: id, departmentId } },
        data: { hourlyBonus },
      });
    }

    await tx.departmentManager.deleteMany({
      where: { userId: id, departmentId: { notIn: managedDepartmentIds } },
    });
    await tx.departmentManager.createMany({
      data: managedDepartmentIds.map((departmentId) => ({ userId: id, departmentId })),
      skipDuplicates: true, // already managed by this user
    });

    return tx.user.findUniqueOrThrow({ where: { id }, include: departmentRolesInclude });
  });

  return res.status(200).json(toUserListItem(user, await hourlyDepartmentIds()));
});

/**
 * POST /api/users/:id/pin — create (or replace) a worker's time clock PIN: a
 * random unique 4 digits, returned ONCE to pass on. Only people in an hourly
 * department clock in, so only they get one.
 */
router.post("/:id/pin", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id as string }, include: { memberships: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const hourly = await hourlyDepartmentIds();
  if (!user.memberships.some((m) => hourly.has(m.departmentId))) {
    return res.status(400).json({ error: "Only people in an hourly department clock in", code: "NOT_HOURLY" });
  }

  const { pin, pinHash } = await generateUniquePin();
  await prisma.user.update({ where: { id: user.id }, data: { pinHash } });
  return res.status(200).json({ pin });
});

export default router;

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, isValidPassword } from "../lib/auth";
import { departmentRolesInclude, toDepartmentRoles } from "../lib/users";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

const router = Router();

// All routes here are restaurant-manager only, per PROJECT_SPEC.md
router.use(authenticate, requireRestaurantManager);

// Where a user works and what they manage — chosen independently.
const departmentRolesSchema = z.object({
  memberDepartmentIds: z.array(z.string().min(1)).default([]),
  managedDepartmentId: z.string().min(1).nullable().default(null),
});

type DepartmentRoles = z.infer<typeof departmentRolesSchema>;

/**
 * Checks department roles against the domain rules before they touch the DB:
 * no duplicate memberships and every departmentId exists. "Manages at most
 * one department" is built into the shape (a single managedDepartmentId).
 * Returns an error message, or null if valid.
 */
async function validateDepartmentRoles({
  memberDepartmentIds,
  managedDepartmentId,
}: DepartmentRoles): Promise<string | null> {
  if (new Set(memberDepartmentIds).size !== memberDepartmentIds.length) {
    return "Each department can only be assigned once";
  }

  const ids = new Set(memberDepartmentIds);
  if (managedDepartmentId) ids.add(managedDepartmentId);

  const found = await prisma.department.count({ where: { id: { in: [...ids] } } });
  if (found !== ids.size) {
    return "One or more departmentIds do not exist";
  }

  return null;
}

function toUserListItem(user: Prisma.UserGetPayload<{ include: typeof departmentRolesInclude }>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isRestaurantManager: user.isRestaurantManager,
    isActive: user.isActive,
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
  const { name, email, temporaryPassword, memberDepartmentIds, managedDepartmentId } = parsed.data;

  if (!isValidPassword(temporaryPassword)) {
    return res
      .status(400)
      .json({ error: "Temporary password must be at least 8 characters and include a letter and a number" });
  }

  const departmentError = await validateDepartmentRoles(parsed.data);
  if (departmentError) {
    return res.status(400).json({ error: departmentError });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      requiresPasswordChange: true,
      memberships: { create: memberDepartmentIds.map((departmentId) => ({ departmentId })) },
      managedDepartment: managedDepartmentId
        ? { create: { departmentId: managedDepartmentId } }
        : undefined,
    },
    include: departmentRolesInclude,
  });

  return res.status(201).json(toUserListItem(user));
});

// GET /api/users — restaurant-manager only
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    include: departmentRolesInclude,
    orderBy: { name: "asc" },
  });

  return res.status(200).json({ users: users.map(toUserListItem) });
});

// PATCH /api/users/:id/departments — restaurant-manager only, full replace of
// { memberDepartmentIds, managedDepartmentId }.
router.patch("/:id/departments", async (req, res) => {
  const parsed = departmentRolesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "memberDepartmentIds and managedDepartmentId are required" });
  }
  const { id } = req.params;
  const { memberDepartmentIds, managedDepartmentId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }
  if (existing.isRestaurantManager && managedDepartmentId) {
    return res.status(400).json({ error: "The restaurant manager already manages every department" });
  }

  const departmentError = await validateDepartmentRoles(parsed.data);
  if (departmentError) {
    return res.status(400).json({ error: departmentError });
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

    if (managedDepartmentId) {
      await tx.departmentManager.upsert({
        where: { userId: id },
        update: { departmentId: managedDepartmentId },
        create: { userId: id, departmentId: managedDepartmentId },
      });
    } else {
      await tx.departmentManager.deleteMany({ where: { userId: id } });
    }

    return tx.user.findUniqueOrThrow({ where: { id }, include: departmentRolesInclude });
  });

  return res.status(200).json(toUserListItem(user));
});

export default router;

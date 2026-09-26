import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, isValidPassword } from "../lib/auth";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

const router = Router();

// All routes here are restaurant-manager only, per PROJECT_SPEC.md
router.use(authenticate, requireRestaurantManager);

const departmentAssignmentSchema = z.object({
  departmentId: z.string().min(1),
  isManager: z.boolean(),
});

type DepartmentAssignment = z.infer<typeof departmentAssignmentSchema>;

/**
 * Checks a department assignment list against the domain rules before it
 * touches the DB: no duplicate departments, a department manager manages at
 * most one department (PROJECT_SPEC.md "Roles"), and every departmentId
 * exists. Returns an error message, or null if the list is valid.
 */
async function validateDepartmentAssignments(
  departments: DepartmentAssignment[]
): Promise<string | null> {
  const ids = departments.map((d) => d.departmentId);

  if (new Set(ids).size !== ids.length) {
    return "Each department can only be assigned once";
  }

  if (departments.filter((d) => d.isManager).length > 1) {
    return "A user can manage at most one department";
  }

  const found = await prisma.department.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    return "One or more departmentIds do not exist";
  }

  return null;
}

function toUserListItem(user: {
  id: string;
  name: string;
  email: string;
  isRestaurantManager: boolean;
  departments: { departmentId: string; isManager: boolean; department: { name: string } }[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isRestaurantManager: user.isRestaurantManager,
    departments: user.departments.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.department.name,
      isManager: d.isManager,
    })),
  };
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  temporaryPassword: z.string().min(1),
  departments: z.array(departmentAssignmentSchema).default([]),
});

// POST /api/users — restaurant-manager only
router.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "name, email, temporaryPassword are required" });
  }
  const { name, email, temporaryPassword, departments } = parsed.data;

  if (!isValidPassword(temporaryPassword)) {
    return res
      .status(400)
      .json({ error: "Temporary password must be at least 8 characters and include a letter and a number" });
  }

  const departmentError = await validateDepartmentAssignments(departments);
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
      departments: {
        create: departments.map((d) => ({
          departmentId: d.departmentId,
          isManager: d.isManager,
        })),
      },
    },
    include: { departments: { include: { department: true } } },
  });

  return res.status(201).json(toUserListItem(user));
});

// GET /api/users — restaurant-manager only
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { departments: { include: { department: true } } },
    orderBy: { name: "asc" },
  });

  return res.status(200).json({ users: users.map(toUserListItem) });
});

const updateDepartmentsSchema = z.object({
  departments: z.array(departmentAssignmentSchema),
});

// PATCH /api/users/:id/departments — restaurant-manager only, full replace
router.patch("/:id/departments", async (req, res) => {
  const parsed = updateDepartmentsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "departments array is required" });
  }
  const { id } = req.params;
  const { departments } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  const departmentError = await validateDepartmentAssignments(departments);
  if (departmentError) {
    return res.status(400).json({ error: departmentError });
  }

  // Full replace: drop all current memberships, then recreate from the payload.
  const user = await prisma.$transaction(async (tx) => {
    await tx.userDepartment.deleteMany({ where: { userId: id } });
    await tx.userDepartment.createMany({
      data: departments.map((d) => ({
        userId: id,
        departmentId: d.departmentId,
        isManager: d.isManager,
      })),
    });
    return tx.user.findUniqueOrThrow({
      where: { id },
      include: { departments: { include: { department: true } } },
    });
  });

  return res.status(200).json(toUserListItem(user));
});

export default router;

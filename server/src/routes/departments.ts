import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, requireDepartmentManager } from "../middleware/auth";

const router = Router();

// Any logged-in user may list departments (workers browse schedules by department).
router.use(authenticate);

// GET /api/departments
router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return res.status(200).json({ departments });
});

// GET /api/departments/:id/members — who can be assigned to this department's slots.
router.get(
  "/:id/members",
  requireDepartmentManager((req) => req.params.id as string),
  async (req, res) => {
    const memberships = await prisma.departmentMembership.findMany({
      where: { departmentId: req.params.id as string, user: { isActive: true } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    });

    return res.status(200).json({ members: memberships.map((m) => m.user) });
  }
);

export default router;

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

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

export default router;

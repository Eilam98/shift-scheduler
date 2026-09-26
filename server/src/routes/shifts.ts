import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireDepartmentManager } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const createSlotSchema = z.object({
  departmentId: z.string().min(1),
});

// POST /api/shifts/:shiftId/slots — add an empty slot for one department.
router.post(
  "/:shiftId/slots",
  (req, res, next) => {
    const parsed = createSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "departmentId is required" });
    }
    res.locals.departmentId = parsed.data.departmentId;
    next();
  },
  requireDepartmentManager((_req, res) => res.locals.departmentId),
  async (req, res) => {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.shiftId as string } });
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }

    const slot = await prisma.shiftSlot.create({
      data: { shiftId: shift.id, departmentId: res.locals.departmentId },
    });

    return res.status(201).json({ id: slot.id, user: null });
  }
);

export default router;

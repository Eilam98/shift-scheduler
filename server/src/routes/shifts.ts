import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { addDays, parseDate, toDateString, todayInTimeZone } from "../lib/dates";
import { authenticate, requireDepartmentManager } from "../middleware/auth";

const router = Router();

router.use(authenticate);

/** How far back GET /mine goes. */
const PAST_DAYS = 30;
const LABEL_ORDER = { MORNING: 0, EVENING: 1 } as const;

/**
 * GET /api/shifts/mine — my shifts from PAST_DAYS ago onward, only in weeks
 * my slot's department has POSTED (drafts stay private to managers). `today`
 * is in the restaurant time zone, so the client can split upcoming / past.
 */
router.get("/mine", async (req, res) => {
  const settings = await prisma.restaurantSettings.findUnique({ where: { id: 1 } });
  const today = todayInTimeZone(settings?.timeZone ?? "Asia/Jerusalem");

  const slots = await prisma.shiftSlot.findMany({
    where: { userId: req.user!.id, shift: { date: { gte: addDays(parseDate(today)!, -PAST_DAYS) } } },
    include: {
      department: true,
      shift: { include: { schedule: { include: { departmentSchedules: true } } } },
    },
  });

  const shifts = slots
    .filter((slot) =>
      slot.shift.schedule.departmentSchedules.some(
        (d) => d.departmentId === slot.departmentId && d.status === "POSTED"
      )
    )
    .map((slot) => ({
      slotId: slot.id,
      date: toDateString(slot.shift.date),
      label: slot.shift.label,
      startTime: slot.shift.startTime,
      endTime: slot.shift.endTime,
      department: { id: slot.department.id, name: slot.department.name },
      weekStartDate: toDateString(slot.shift.schedule.weekStartDate),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || LABEL_ORDER[a.label] - LABEL_ORDER[b.label]);

  return res.status(200).json({ today, shifts });
});

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

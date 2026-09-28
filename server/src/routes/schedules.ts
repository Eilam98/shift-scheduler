import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { addDays, parseWeekStart, toDateString } from "../lib/dates";
import { authenticate, canManageDepartment, requireAnyManager } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const createScheduleSchema = z.object({
  weekStartDate: z.string(),
});

/**
 * POST /api/schedules — create the week if it doesn't exist yet: the Schedule
 * row, one MORNING + one EVENING Shift per day (times from ShiftTemplate),
 * and a DRAFT DepartmentSchedule for every department. Idempotent, since the
 * week is shared by all departments and any of their managers may open it first.
 */
router.post("/", requireAnyManager, async (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body);
  const weekStart = parsed.success ? parseWeekStart(parsed.data.weekStartDate) : null;
  if (!weekStart) {
    return res.status(400).json({ error: "weekStartDate must be a Sunday in YYYY-MM-DD format" });
  }

  const [existing, templates, departments] = await Promise.all([
    prisma.schedule.findUnique({ where: { weekStartDate: weekStart } }),
    prisma.shiftTemplate.findMany(),
    prisma.department.findMany({ select: { id: true } }),
  ]);

  if (existing) {
    // Fill in DepartmentSchedules for departments added after the week was
    // created (e.g. Shift Managers), so every department can open it.
    await prisma.departmentSchedule.createMany({
      data: departments.map((d) => ({ scheduleId: existing.id, departmentId: d.id })),
      skipDuplicates: true,
    });
    return res.status(200).json({ schedule: toScheduleResponse(existing) });
  }

  const shifts = [];
  for (let day = 0; day < 7; day++) {
    for (const template of templates) {
      shifts.push({
        date: addDays(weekStart, day),
        label: template.label,
        startTime: template.defaultStartTime,
        endTime: template.defaultEndTime,
      });
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      weekStartDate: weekStart,
      shifts: { create: shifts },
      departmentSchedules: {
        create: departments.map((d) => ({ departmentId: d.id })),
      },
    },
  });

  return res.status(201).json({ schedule: toScheduleResponse(schedule) });
});

/**
 * GET /api/schedules/:weekStart/departments/:departmentId — one department's
 * view of the week: every shift with that department's slots. Managers of the
 * department (and the restaurant manager) see drafts; everyone else only
 * once the department has POSTED it.
 */
router.get("/:weekStart/departments/:departmentId", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "weekStart must be a Sunday in YYYY-MM-DD format" });
  }
  const { departmentId } = req.params;

  const schedule = await prisma.schedule.findUnique({
    where: { weekStartDate: weekStart },
    include: {
      departmentSchedules: { where: { departmentId }, include: { department: true } },
      shifts: {
        orderBy: [{ date: "asc" }, { label: "asc" }],
        include: {
          slots: {
            where: { departmentId },
            orderBy: { id: "asc" },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const departmentSchedule = schedule?.departmentSchedules[0];
  if (!schedule || !departmentSchedule) {
    return res.status(404).json({ error: "No schedule for this week yet" });
  }

  const canEdit = canManageDepartment(req.user!, departmentId);
  if (!canEdit && departmentSchedule.status !== "POSTED") {
    return res
      .status(403)
      .json({ error: "This schedule hasn't been posted yet", code: "SCHEDULE_NOT_POSTED" });
  }

  return res.status(200).json({
    schedule: toScheduleResponse(schedule),
    departmentId,
    departmentName: departmentSchedule.department.name,
    status: departmentSchedule.status,
    postedAt: departmentSchedule.postedAt,
    canEdit,
    shifts: schedule.shifts.map((shift) => ({
      id: shift.id,
      date: toDateString(shift.date),
      label: shift.label,
      startTime: shift.startTime,
      endTime: shift.endTime,
      slots: shift.slots.map((slot) => ({ id: slot.id, user: slot.user })),
    })),
  });
});

function toScheduleResponse(schedule: { id: string; weekStartDate: Date }) {
  return { id: schedule.id, weekStartDate: toDateString(schedule.weekStartDate) };
}

export default router;

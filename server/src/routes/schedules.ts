import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseWeekStart, toDateString } from "../lib/dates";
import { ensureWeek } from "../lib/schedules";
import { notifyWeekPosted } from "../lib/notifications";
import { pushInBackground } from "../lib/push";
import {
  authenticate,
  canManageDepartment,
  canViewDrafts,
  requireAnyManager,
  requireDepartmentManager,
} from "../middleware/auth";

const router = Router();

router.use(authenticate);

const createScheduleSchema = z.object({
  weekStartDate: z.string(),
});

/**
 * POST /api/schedules — create the week if it doesn't exist yet (see
 * ensureWeek in lib/schedules.ts). Idempotent, since the week is shared by all
 * departments and any of their managers may open it first.
 */
router.post("/", requireAnyManager, async (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body);
  const weekStart = parsed.success ? parseWeekStart(parsed.data.weekStartDate) : null;
  if (!weekStart) {
    return res.status(400).json({ error: "weekStartDate must be a Sunday in YYYY-MM-DD format" });
  }

  const { schedule, created } = await ensureWeek(weekStart);
  return res.status(created ? 201 : 200).json({ schedule: toScheduleResponse(schedule) });
});

/**
 * GET /api/schedules/:weekStart/departments/:departmentId — one department's
 * view of the week: every shift with that department's slots. Managers of the
 * department (and the restaurant manager) edit it; department managers and
 * shift managers can also read drafts; everyone else only once POSTED.
 */
router.get("/:weekStart/departments/:departmentId", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "weekStart must be a Sunday in YYYY-MM-DD format" });
  }
  const { departmentId } = req.params;

  // Editors also get which of this department's workers already work a shift
  // of this week in ANOTHER department (blue in the workers panel; counts
  // toward their shifts this week). Fetched in parallel with the week.
  const canEdit = canManageDepartment(req.user!, departmentId);
  const elsewhereQuery = canEdit
    ? prisma.shiftSlot.findMany({
        where: {
          shift: { schedule: { weekStartDate: weekStart } },
          departmentId: { not: departmentId },
          user: { memberships: { some: { departmentId } } },
        },
        include: { department: { select: { name: true } } },
      })
    : Promise.resolve([]);

  const scheduleQuery = prisma.schedule.findUnique({
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

  const [schedule, elsewhere] = await Promise.all([scheduleQuery, elsewhereQuery]);
  const departmentSchedule = schedule?.departmentSchedules[0];
  if (!schedule || !departmentSchedule) {
    return res.status(404).json({ error: "No schedule for this week yet" });
  }

  if (!canEdit && departmentSchedule.status !== "POSTED" && !(await canViewDrafts(req.user!))) {
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
    elsewhere: elsewhere.map((slot) => ({
      userId: slot.userId!,
      shiftId: slot.shiftId,
      departmentId: slot.departmentId,
      departmentName: slot.department.name,
    })),
  });
});

const statusSchema = z.object({
  status: z.enum(["POSTED", "DRAFT"]),
});

/**
 * PATCH /api/schedules/:weekStart/departments/:departmentId — post (or
 * unpost) one department's week. Posting tells everyone with a shift in it.
 * Posted weeks stay editable; later changes notify the people affected
 * (see routes/slots.ts).
 */
router.patch(
  "/:weekStart/departments/:departmentId",
  requireDepartmentManager((req) => req.params.departmentId as string),
  async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "status must be POSTED or DRAFT" });
    }
    const weekStart = parseWeekStart(req.params.weekStart as string);
    if (!weekStart) {
      return res.status(400).json({ error: "weekStart must be a Sunday in YYYY-MM-DD format" });
    }
    const departmentId = req.params.departmentId as string;
    const { status } = parsed.data;

    const schedule = await prisma.schedule.findUnique({ where: { weekStartDate: weekStart } });
    const current = schedule
      ? await prisma.departmentSchedule.findUnique({
          where: { scheduleId_departmentId: { scheduleId: schedule.id, departmentId } },
        })
      : null;
    if (!schedule || !current) {
      return res.status(404).json({ error: "No schedule for this week yet" });
    }
    if (current.status === status) {
      return res.status(200).json({ status: current.status, postedAt: current.postedAt });
    }

    const { week: updated, notified } = await prisma.$transaction(async (tx) => {
      const week = await tx.departmentSchedule.update({
        where: { id: current.id },
        data: { status, postedAt: status === "POSTED" ? new Date() : null },
      });
      const notified =
        status === "POSTED" ? await notifyWeekPosted(tx, { scheduleId: schedule.id, departmentId, actorId: req.user!.id }) : [];
      return { week, notified };
    });
    pushInBackground(notified); // phones, after the commit

    return res.status(200).json({ status: updated.status, postedAt: updated.postedAt });
  }
);

function toScheduleResponse(schedule: { id: string; weekStartDate: Date }) {
  return { id: schedule.id, weekStartDate: toDateString(schedule.weekStartDate) };
}

export default router;

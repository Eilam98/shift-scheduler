import { Router } from "express";
import { Availability, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  addDays,
  availabilityDeadline,
  isPastDeadline,
  parseWeekStart,
  toDateString,
  todayInTimeZone,
  weekStartOf,
} from "../lib/dates";
import { getSettings } from "../lib/settings";
import { authenticate, canManageUser, requireAnyManager } from "../middleware/auth";

const router = Router();

router.use(authenticate);

const LABELS = ["MORNING", "EVENING"] as const;

type Settings = Awaited<ReturnType<typeof getSettings>>;
type Row = Availability & { updatedBy: { id: string; name: string } | null };

/** Deadline + lock state for one week. */
function weekInfo(weekStart: Date, settings: Settings) {
  const deadline = availabilityDeadline(weekStart, settings);
  return {
    weekStartDate: toDateString(weekStart),
    deadline: deadline.toISOString(),
    timeZone: settings.timeZone, // show the deadline in restaurant time, whatever the device's zone
    locked: isPastDeadline(deadline),
  };
}

/** The soonest week whose deadline hasn't passed yet (what workers fill in next). */
function nextOpenWeek(settings: Settings): Date {
  let week = weekStartOf(todayInTimeZone(settings.timeZone));
  while (isPastDeadline(availabilityDeadline(week, settings))) week = addDays(week, 7);
  return week;
}

/** `?week=` if given (400 if not a Sunday), else the next open week. */
function resolveWeek(value: unknown, settings: Settings): Date | null {
  return value === undefined ? nextOpenWeek(settings) : parseWeekStart(String(value));
}

const rowsInWeek = (weekStart: Date) => ({ gte: weekStart, lt: addDays(weekStart, 7) });

/**
 * One person's week as 14 entries (Sun morning … Sat evening). Shifts with no
 * row default to AVAILABLE — a week "opens" with everything on "can".
 * `updatedBy` is the manager who last changed it, if any.
 */
function toWeekSubmission(weekStart: Date, rows: Row[]) {
  const entries = [];
  for (let day = 0; day < 7; day++) {
    const date = toDateString(addDays(weekStart, day));
    for (const label of LABELS) {
      const row = rows.find((r) => toDateString(r.date) === date && r.label === label);
      entries.push({ date, label, status: row?.status ?? "AVAILABLE", note: row?.note ?? null });
    }
  }
  const latest = rows.reduce<Row | null>((a, r) => (!a || r.updatedAt > a.updatedAt ? r : a), null);
  return {
    submitted: rows.length > 0,
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: latest?.updatedBy ?? null,
    entries,
  };
}

const updatedByInclude = { updatedBy: { select: { id: true, name: true } } } as const;

const entrySchema = z.object({
  date: z.string(),
  label: z.enum(LABELS),
  status: z.enum(["AVAILABLE", "PREFER_NOT", "UNAVAILABLE"]),
  note: z.string().trim().max(200).nullish(),
});
const weekSchema = z.object({ entries: z.array(entrySchema).length(14) });

/** Validates a full week body: 14 entries, every (day, shift) of this week exactly once. */
function parseWeek(body: unknown, weekStart: Date) {
  const parsed = weekSchema.safeParse(body);
  if (!parsed.success) return null;
  const days = new Set(Array.from({ length: 7 }, (_, i) => toDateString(addDays(weekStart, i))));
  const keys = new Set(parsed.data.entries.map((e) => `${e.date}/${e.label}`));
  const allInWeek = parsed.data.entries.every((e) => days.has(e.date));
  return allInWeek && keys.size === 14 ? parsed.data.entries : null;
}

/** Replace a person's whole week. `updatedById` null = the worker themselves. */
function saveWeek(
  userId: string,
  weekStart: Date,
  entries: z.infer<typeof entrySchema>[],
  updatedById: string | null
) {
  return prisma.$transaction([
    prisma.availability.deleteMany({ where: { userId, date: rowsInWeek(weekStart) } }),
    prisma.availability.createMany({
      data: entries.map(
        (e): Prisma.AvailabilityCreateManyInput => ({
          userId,
          date: new Date(`${e.date}T00:00:00Z`),
          label: e.label,
          status: e.status,
          note: e.note || null,
          updatedById,
        })
      ),
    }),
  ]);
}

async function loadWeek(userId: string, weekStart: Date) {
  const rows = await prisma.availability.findMany({
    where: { userId, date: rowsInWeek(weekStart) },
    include: updatedByInclude,
  });
  return toWeekSubmission(weekStart, rows);
}

const BAD_WEEK = { error: "week must be a Sunday in YYYY-MM-DD format" };
const BAD_ENTRIES = { error: "entries must list each of the week's 14 shifts once" };

// GET /api/availability/me?week= — my submission (+ deadline) for a week.
router.get("/me", async (req, res) => {
  const settings = await getSettings();
  const weekStart = resolveWeek(req.query.week, settings);
  if (!weekStart) return res.status(400).json(BAD_WEEK);

  return res.status(200).json({
    ...weekInfo(weekStart, settings),
    ...(await loadWeek(req.user!.id, weekStart)),
  });
});

// PUT /api/availability/me/:weekStart — submit or change my week, until the deadline.
router.put("/me/:weekStart", async (req, res) => {
  const settings = await getSettings();
  const weekStart = parseWeekStart(req.params.weekStart as string);
  if (!weekStart) return res.status(400).json(BAD_WEEK);

  const info = weekInfo(weekStart, settings);
  if (info.locked) {
    return res.status(403).json({
      error: "The deadline for this week has passed — ask your manager to change it",
      code: "AVAILABILITY_LOCKED",
    });
  }

  const entries = parseWeek(req.body, weekStart);
  if (!entries) return res.status(400).json(BAD_ENTRIES);

  await saveWeek(req.user!.id, weekStart, entries, null);
  return res.status(200).json({ ...info, ...(await loadWeek(req.user!.id, weekStart)) });
});

/**
 * GET /api/availability/team?week=&departmentId= — "הגשות העובדים": the
 * submissions of everyone working in the departments I manage (restaurant
 * manager: all), optionally one department. Also used by the schedule editor.
 */
router.get("/team", requireAnyManager, async (req, res) => {
  const user = req.user!;
  const settings = await getSettings();
  const weekStart = resolveWeek(req.query.week, settings);
  if (!weekStart) return res.status(400).json(BAD_WEEK);

  const requested = req.query.departmentId ? String(req.query.departmentId) : null;
  if (requested && !user.isRestaurantManager && !user.managedDepartmentIds.includes(requested)) {
    return res.status(403).json({ error: "Department manager access required" });
  }
  const departmentFilter = requested
    ? { departmentId: requested }
    : user.isRestaurantManager
      ? {}
      : { departmentId: { in: user.managedDepartmentIds } };

  const workers = await prisma.user.findMany({
    where: { isActive: true, memberships: { some: departmentFilter } },
    include: {
      memberships: { include: { department: true } },
      availability: { where: { date: rowsInWeek(weekStart) }, include: updatedByInclude },
    },
    orderBy: { name: "asc" },
  });

  return res.status(200).json({
    ...weekInfo(weekStart, settings),
    workers: workers.map((w) => ({
      id: w.id,
      name: w.name,
      departments: w.memberships
        .map((m) => ({ departmentId: m.departmentId, departmentName: m.department.name }))
        .sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
      ...toWeekSubmission(weekStart, w.availability),
    })),
  });
});

// PUT /api/availability/users/:userId/:weekStart — a manager changes a worker's
// week (any time, even after the deadline). Applies in all their departments.
router.put("/users/:userId/:weekStart", requireAnyManager, async (req, res) => {
  const settings = await getSettings();
  const weekStart = parseWeekStart(req.params.weekStart as string);
  if (!weekStart) return res.status(400).json(BAD_WEEK);
  const userId = req.params.userId as string;

  if (!(await canManageUser(req.user!, userId))) {
    return res.status(403).json({
      error: "You can only change submissions of people in your departments",
      code: "NOT_YOUR_WORKER",
    });
  }

  const entries = parseWeek(req.body, weekStart);
  if (!entries) return res.status(400).json(BAD_ENTRIES);

  await saveWeek(userId, weekStart, entries, req.user!.id);
  return res.status(200).json({ ...weekInfo(weekStart, settings), ...(await loadWeek(userId, weekStart)) });
});

export default router;

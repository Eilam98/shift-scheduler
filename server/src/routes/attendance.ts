import { NextFunction, Request, Response, Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  addDays,
  parseWeekStart,
  parseZonedDateTime,
  toDateString,
  todayInTimeZone,
  weekStartOf,
  zonedTimeToUtc,
} from "../lib/dates";
import { hourlyDepartmentIds } from "../lib/pay";
import { getSettings } from "../lib/settings";
import { AuthenticatedUser, authenticate, requireAnyManager } from "../middleware/auth";

// Attendance (PROJECT_SPEC.md "Time tracking"): managers review and correct
// time clock entries of their hourly departments (restaurant manager: all).
const router = Router();
router.use(authenticate, requireAnyManager);

/** An open entry older than this has a missing clock-out. */
const OPEN_ENTRY_MAX_MS = 16 * 60 * 60_000;

/** The hourly departments this manager handles. */
async function attendanceDepartmentIds(user: AuthenticatedUser): Promise<string[]> {
  const hourly = await hourlyDepartmentIds();
  return user.isRestaurantManager ? [...hourly] : user.managedDepartmentIds.filter((id) => hourly.has(id));
}

/**
 * Entries a manager may see: in one of their departments, or department-less
 * (unscheduled, several hourly departments) for someone who works in one.
 */
function visibleEntries(departmentIds: string[]): Prisma.TimeEntryWhereInput {
  return {
    OR: [
      { departmentId: { in: departmentIds } },
      { departmentId: null, user: { memberships: { some: { departmentId: { in: departmentIds } } } } },
    ],
  };
}

const entryInclude = {
  user: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  shift: true,
  station: { select: { name: true } },
  enteredBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} satisfies Prisma.TimeEntryInclude;

type EntryRow = Prisma.TimeEntryGetPayload<{ include: typeof entryInclude }>;

function toEntryResponse(e: EntryRow, now = new Date()) {
  return {
    id: e.id,
    user: e.user,
    department: e.department,
    shift: e.shift && {
      date: toDateString(e.shift.date),
      label: e.shift.label,
      startTime: e.shift.startTime,
      endTime: e.shift.endTime,
    },
    clockIn: e.clockIn,
    clockOut: e.clockOut,
    source: e.source,
    station: e.station?.name ?? null,
    flagged: e.flagged,
    reviewedAt: e.reviewedAt,
    reviewedBy: e.reviewedBy?.name ?? null,
    enteredBy: e.enteredBy?.name ?? null,
    note: e.note,
    missingClockOut: !e.clockOut && now.getTime() - e.clockIn.getTime() > OPEN_ENTRY_MAX_MS,
  };
}

/**
 * GET /api/attendance?week=&departmentId= — one week of entries (by clock-in,
 * restaurant time), plus the departments and workers for the editor's pickers.
 */
router.get("/", async (req, res) => {
  const settings = await getSettings();
  const departmentIds = await attendanceDepartmentIds(req.user!);
  const weekStart = req.query.week
    ? parseWeekStart(String(req.query.week))
    : weekStartOf(todayInTimeZone(settings.timeZone));
  if (!weekStart) return res.status(400).json({ error: "week must be a Sunday in YYYY-MM-DD format" });

  const requested = req.query.departmentId ? String(req.query.departmentId) : null;
  if (requested && !departmentIds.includes(requested)) {
    return res.status(403).json({ error: "Department manager access required" });
  }
  const scope = requested ? [requested] : departmentIds;

  const from = zonedTimeToUtc(toDateString(weekStart), "00:00", settings.timeZone);
  const to = zonedTimeToUtc(toDateString(addDays(weekStart, 7)), "00:00", settings.timeZone);

  const [entries, departments, workers] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { AND: [visibleEntries(scope), { clockIn: { gte: from, lt: to } }] },
      include: entryInclude,
      orderBy: { clockIn: "asc" },
    }),
    prisma.department.findMany({ where: { id: { in: departmentIds } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true, memberships: { some: { departmentId: { in: departmentIds } } } },
      include: { memberships: { where: { departmentId: { in: departmentIds } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  return res.status(200).json({
    weekStartDate: toDateString(weekStart),
    timeZone: settings.timeZone,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    workers: workers.map((w) => ({ id: w.id, name: w.name, departmentIds: w.memberships.map((m) => m.departmentId) })),
    entries: entries.map((e) => toEntryResponse(e, now)),
  });
});

/** Loads the entry into res.locals and checks this manager may change it. */
async function loadEntry(req: Request, res: Response, next: NextFunction) {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: req.params.id as string },
    include: { user: { include: { memberships: true } } },
  });
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const departmentIds = await attendanceDepartmentIds(req.user!);
  const allowed = entry.departmentId
    ? departmentIds.includes(entry.departmentId)
    : entry.user.memberships.some((m) => departmentIds.includes(m.departmentId));
  if (!allowed) return res.status(403).json({ error: "Department manager access required" });

  res.locals.entry = entry;
  res.locals.departmentIds = departmentIds;
  next();
}

const localDateTime = z.string(); // "YYYY-MM-DDTHH:mm" in restaurant time
const INVALID_TIMES = {
  error: "Clock-out must be after clock-in",
  code: "INVALID_TIMES",
};

/** A department the manager handles and the worker belongs to. */
async function checkDepartment(
  departmentId: string,
  userId: string,
  departmentIds: string[]
): Promise<object | null> {
  if (!departmentIds.includes(departmentId)) return { error: "Department manager access required" };
  const membership = await prisma.departmentMembership.findUnique({
    where: { userId_departmentId: { userId, departmentId } },
  });
  return membership ? null : { error: "That worker isn't in this department", code: "NOT_IN_DEPARTMENT" };
}

const updateSchema = z.object({
  clockIn: localDateTime.optional(),
  clockOut: localDateTime.nullable().optional(), // null = still clocked in
  departmentId: z.string().min(1).optional(),
  note: z.string().trim().max(200).nullable().optional(),
  approve: z.literal(true).optional(),
});

/**
 * PATCH /api/attendance/:id — fix times / assign a department / note, and/or
 * approve a flagged entry. Records which manager changed it.
 */
router.patch("/:id", loadEntry, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid attendance change" });
  const body = parsed.data;
  const entry = res.locals.entry;
  const settings = await getSettings();

  const clockIn = body.clockIn ? parseZonedDateTime(body.clockIn, settings.timeZone) : entry.clockIn;
  const clockOut =
    body.clockOut === undefined ? entry.clockOut : body.clockOut && parseZonedDateTime(body.clockOut, settings.timeZone);
  if (!clockIn || (body.clockOut && !clockOut)) return res.status(400).json({ error: "Times must be YYYY-MM-DDTHH:mm" });
  if (clockOut && clockOut <= clockIn) return res.status(400).json(INVALID_TIMES);

  if (body.departmentId) {
    const problem = await checkDepartment(body.departmentId, entry.userId, res.locals.departmentIds);
    if (problem) return res.status(400).json(problem);
  }

  const edited = body.clockIn !== undefined || body.clockOut !== undefined || body.departmentId || body.note !== undefined;
  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockIn,
      clockOut,
      ...(body.departmentId && { departmentId: body.departmentId }),
      ...(body.note !== undefined && { note: body.note || null }),
      ...(edited && { enteredById: req.user!.id }),
      ...(body.approve && { reviewedAt: new Date(), reviewedById: req.user!.id }),
    },
    include: entryInclude,
  });
  return res.status(200).json(toEntryResponse(updated));
});

const createSchema = z.object({
  userId: z.string().min(1),
  departmentId: z.string().min(1),
  clockIn: localDateTime,
  clockOut: localDateTime.nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

// POST /api/attendance — add a missed entry by hand (not flagged: a manager entered it).
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "userId, departmentId and clockIn are required" });
  const body = parsed.data;
  const settings = await getSettings();

  const clockIn = parseZonedDateTime(body.clockIn, settings.timeZone);
  const clockOut = body.clockOut ? parseZonedDateTime(body.clockOut, settings.timeZone) : null;
  if (!clockIn || (body.clockOut && !clockOut)) return res.status(400).json({ error: "Times must be YYYY-MM-DDTHH:mm" });
  if (clockOut && clockOut <= clockIn) return res.status(400).json(INVALID_TIMES);

  const problem = await checkDepartment(body.departmentId, body.userId, await attendanceDepartmentIds(req.user!));
  if (problem) return res.status(400).json(problem);

  const entry = await prisma.timeEntry.create({
    data: {
      userId: body.userId,
      departmentId: body.departmentId,
      clockIn,
      clockOut,
      source: "MANUAL",
      enteredById: req.user!.id,
      note: body.note || null,
    },
    include: entryInclude,
  });
  return res.status(201).json(toEntryResponse(entry));
});

// DELETE /api/attendance/:id — remove a mistaken entry.
router.delete("/:id", loadEntry, async (_req, res) => {
  await prisma.timeEntry.delete({ where: { id: res.locals.entry.id } });
  return res.status(204).end();
});

export default router;

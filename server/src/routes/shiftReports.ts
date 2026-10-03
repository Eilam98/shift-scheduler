import { Router } from "express";
import { Shift } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { addDays, parseDate, shiftWindow, toDateString, todayInTimeZone, weekStartOf, zonedTimeToUtc } from "../lib/dates";
import { tipsDepartmentIds } from "../lib/pay";
import { ensureWeek } from "../lib/schedules";
import { getSettings } from "../lib/settings";
import { splitTips } from "../lib/tips";
import { authenticate, requireReportAccess } from "../middleware/auth";

// End-of-shift report (PROJECT_SPEC.md "Time tracking"): a shift manager
// enters each tips-department worker's hours and the shift's total tips.
// Hours are TimeEntry rows (source REPORT); tips a TipPool; shares computed.
const router = Router();
router.use(authenticate, requireReportAccess);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_MINUTES = 16 * 60;
const RECENT_DAYS = 7;
const LABELS = ["MORNING", "EVENING"] as const;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Minutes from start to end; an end not after the start is the next day. */
const minutesBetween = (start: string, end: string) =>
  ((toMinutes(end) - toMinutes(start) + 24 * 60 - 1) % (24 * 60)) + 1;

/** "HH:mm" of a moment in the restaurant time zone. */
function zonedHHMM(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** Everything the report page needs for one shift: saved report, or rows prefilled from the schedule. */
async function loadReport(shift: Shift) {
  const settings = await getSettings();
  const tipsIds = [...(await tipsDepartmentIds())];
  const [pool, entries, departments, candidates] = await Promise.all([
    prisma.tipPool.findUnique({ where: { shiftId: shift.id }, include: { enteredBy: { select: { name: true } } } }),
    prisma.timeEntry.findMany({
      where: { shiftId: shift.id, source: "REPORT" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.department.findMany({ where: { id: { in: tipsIds } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true, memberships: { some: { departmentId: { in: tipsIds } } } },
      include: { memberships: { where: { departmentId: { in: tipsIds } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const saved = !!pool || entries.length > 0;
  let rows: { userId: string; name: string; departmentId: string; start: string; end: string }[];
  if (saved) {
    rows = entries.map((e) => ({
      userId: e.userId,
      name: e.user.name,
      departmentId: e.departmentId!,
      start: zonedHHMM(e.clockIn, settings.timeZone),
      end: e.clockOut ? zonedHHMM(e.clockOut, settings.timeZone) : shift.endTime,
    }));
  } else {
    // Not filled in yet: start from who was scheduled in the tips departments.
    const slots = await prisma.shiftSlot.findMany({
      where: { shiftId: shift.id, departmentId: { in: tipsIds }, userId: { not: null } },
      include: { user: { select: { name: true } } },
      orderBy: { id: "asc" },
    });
    rows = slots.map((s) => ({
      userId: s.userId!,
      name: s.user!.name,
      departmentId: s.departmentId,
      start: shift.startTime,
      end: shift.endTime,
    }));
  }

  const minutes = rows.map((r) => minutesBetween(r.start, r.end));
  const shares = splitTips(pool?.totalAmount ?? 0, minutes);

  return {
    timeZone: settings.timeZone,
    shift: { id: shift.id, date: toDateString(shift.date), label: shift.label, startTime: shift.startTime, endTime: shift.endTime },
    report: pool && { totalAmount: pool.totalAmount, enteredBy: pool.enteredBy.name, updatedAt: pool.updatedAt },
    prefilled: !saved,
    rows: rows.map((r, i) => ({ ...r, minutes: minutes[i], share: shares[i] })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    candidates: candidates.map((u) => ({ id: u.id, name: u.name, departmentIds: u.memberships.map((m) => m.departmentId) })),
  };
}

const querySchema = z.object({ date: z.string(), label: z.enum(LABELS) });

/**
 * GET /api/shift-reports?date=YYYY-MM-DD&label=MORNING|EVENING — one shift's
 * report. Creates the week first if nobody has yet, so the shift exists.
 */
router.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const date = parsed.success ? parseDate(parsed.data.date) : null;
  if (!parsed.success || !date) return res.status(400).json({ error: "date (YYYY-MM-DD) and label are required" });

  const { schedule } = await ensureWeek(weekStartOf(parsed.data.date));
  const shift = await prisma.shift.findUnique({
    where: { scheduleId_date_label: { scheduleId: schedule.id, date, label: parsed.data.label } },
  });
  if (!shift) return res.status(404).json({ error: "Shift not found" });
  return res.status(200).json(await loadReport(shift));
});

/**
 * GET /api/shift-reports/recent — the last 7 days' shifts that have started,
 * newest first, with whether a report was saved (to spot missing ones).
 */
router.get("/recent", async (_req, res) => {
  const settings = await getSettings();
  const today = parseDate(todayInTimeZone(settings.timeZone))!;
  const dates = Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, -i));
  const [shifts, templates] = await Promise.all([
    prisma.shift.findMany({ where: { date: { in: dates } }, include: { tipPool: true } }),
    prisma.shiftTemplate.findMany(),
  ]);

  const now = new Date();
  const recent = [];
  for (const date of dates) {
    for (const label of [...LABELS].reverse()) {
      const shift = shifts.find((s) => s.date.getTime() === date.getTime() && s.label === label);
      const template = templates.find((t) => t.label === label);
      const times = shift ?? (template && { startTime: template.defaultStartTime, endTime: template.defaultEndTime });
      if (!times) continue;
      const { start, end } = shiftWindow(date, times.startTime, times.endTime, settings.timeZone);
      if (start > now) continue; // hasn't started yet
      recent.push({
        date: toDateString(date),
        label,
        ended: end <= now,
        hasReport: !!shift?.tipPool,
        totalAmount: shift?.tipPool?.totalAmount ?? null,
      });
    }
  }
  return res.status(200).json({ shifts: recent });
});

const saveSchema = z.object({
  totalAmount: z.number().int().min(0).max(100_000_000), // agorot (up to 1,000,000 ₪)
  rows: z
    .array(
      z.object({
        userId: z.string().min(1),
        departmentId: z.string().min(1),
        start: z.string().regex(HHMM),
        end: z.string().regex(HHMM),
      })
    )
    .max(100),
});

/**
 * PUT /api/shift-reports/:shiftId { totalAmount, rows } — save (or correct)
 * the whole report: replaces the shift's REPORT hours and its tip pool.
 */
router.put("/:shiftId", async (req, res) => {
  const shift = await prisma.shift.findUnique({ where: { id: req.params.shiftId as string } });
  if (!shift) return res.status(404).json({ error: "Shift not found" });

  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Times must be HH:mm and the total a whole number of agorot" });
  const { totalAmount, rows } = parsed.data;

  if (new Set(rows.map((r) => r.userId)).size !== rows.length) {
    return res.status(400).json({ error: "Each worker can appear only once", code: "DUPLICATE_WORKER" });
  }
  if (totalAmount > 0 && rows.length === 0) {
    return res.status(400).json({ error: "Add the workers who share the tips", code: "TIPS_WITHOUT_WORKERS" });
  }
  if (rows.some((r) => minutesBetween(r.start, r.end) > MAX_MINUTES)) {
    return res.status(400).json({ error: "A row can't be longer than 16 hours", code: "SHIFT_TOO_LONG" });
  }

  // Every row: an active member of a tips department, entered under that department.
  const tipsIds = await tipsDepartmentIds();
  const memberships = await prisma.departmentMembership.findMany({
    where: { userId: { in: rows.map((r) => r.userId) }, user: { isActive: true } },
  });
  const invalid = rows.find(
    (r) => !tipsIds.has(r.departmentId) || !memberships.some((m) => m.userId === r.userId && m.departmentId === r.departmentId)
  );
  if (invalid) {
    return res
      .status(400)
      .json({ error: "Every worker must belong to the tips department they're listed under", code: "NOT_IN_DEPARTMENT" });
  }

  const settings = await getSettings();
  const day = toDateString(shift.date);
  const nextDay = toDateString(addDays(shift.date, 1));
  await prisma.$transaction([
    prisma.timeEntry.deleteMany({ where: { shiftId: shift.id, source: "REPORT" } }),
    prisma.timeEntry.createMany({
      data: rows.map((r) => ({
        userId: r.userId,
        departmentId: r.departmentId,
        shiftId: shift.id,
        clockIn: zonedTimeToUtc(day, r.start, settings.timeZone),
        clockOut: zonedTimeToUtc(r.end <= r.start ? nextDay : day, r.end, settings.timeZone),
        source: "REPORT" as const,
        enteredById: req.user!.id,
      })),
    }),
    prisma.tipPool.upsert({
      where: { shiftId: shift.id },
      create: { shiftId: shift.id, totalAmount, enteredById: req.user!.id },
      update: { totalAmount, enteredById: req.user!.id },
    }),
  ]);

  return res.status(200).json(await loadReport(shift));
});

export default router;

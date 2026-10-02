import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { addDays, parseDate, shiftWindow, todayInTimeZone } from "../lib/dates";
import { hourlyDepartmentIds } from "../lib/pay";
import { PIN_RULE, hashPin } from "../lib/pins";
import { getSettings } from "../lib/settings";
import { authenticateStation } from "../middleware/station";

// The time clock device's API (PROJECT_SPEC.md "Time tracking"). Every route
// needs the station key (X-Station-Token); no user is logged in on the device.
const router = Router();
router.use(authenticateStation);

const MAX_WRONG_PINS = 5;
const LOCK_MS = 60_000;
/** An open entry older than this is a forgotten clock-out: left for the manager, not closed. */
const OPEN_ENTRY_MAX_MS = 16 * 60 * 60_000;
/** A clock-in this long before a scheduled shift's start still counts for that shift. */
const EARLY_MS = 2 * 60 * 60_000;

/** Wrong-PIN streaks per station, in memory (reset on server restart — fine for a lockout). */
const wrongPins = new Map<string, { count: number; lockedUntil: number }>();

// GET /api/station/me — is this device an active time clock? (The station page checks on load.)
router.get("/me", async (_req, res) => {
  const settings = await getSettings();
  return res.status(200).json({ name: res.locals.station.name, timeZone: settings.timeZone });
});

const punchSchema = z.object({ pin: z.string().regex(PIN_RULE) });

/**
 * POST /api/station/punch { pin } — clock the PIN's owner in, or out if they
 * have an open entry from the last 16 h. Times come from the server clock.
 */
router.post("/punch", async (req, res) => {
  const station = res.locals.station;
  const streak = wrongPins.get(station.id);
  if (streak && streak.lockedUntil > Date.now()) {
    const seconds = String(Math.ceil((streak.lockedUntil - Date.now()) / 1000));
    return res
      .status(429)
      .json({ error: `Too many wrong PINs — try again in ${seconds}s`, code: "STATION_LOCKED", params: { seconds } });
  }

  const parsed = punchSchema.safeParse(req.body);
  const user = parsed.success
    ? await prisma.user.findUnique({
        where: { pinHash: hashPin(parsed.data.pin) },
        include: { memberships: { include: { department: true } } },
      })
    : null;
  if (!user || !user.isActive) {
    const count = (streak?.count ?? 0) + 1;
    wrongPins.set(station.id, { count, lockedUntil: count >= MAX_WRONG_PINS ? Date.now() + LOCK_MS : 0 });
    return res.status(401).json({ error: "Wrong PIN", code: "WRONG_PIN" });
  }
  wrongPins.delete(station.id);

  const now = new Date();
  const touchStation = prisma.stationDevice.update({ where: { id: station.id }, data: { lastUsedAt: now } });

  // Clock out?
  const open = await prisma.timeEntry.findFirst({
    where: { userId: user.id, clockOut: null, clockIn: { gte: new Date(now.getTime() - OPEN_ENTRY_MAX_MS) } },
    orderBy: { clockIn: "desc" },
    include: { department: true },
  });
  if (open) {
    await Promise.all([prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: now } }), touchStation]);
    return res.status(200).json({
      action: "OUT",
      name: user.name,
      at: now.toISOString(),
      clockIn: open.clockIn.toISOString(),
      department: open.department && { id: open.department.id, name: open.department.name },
    });
  }

  // Clock in: only people in an hourly department.
  const hourly = await hourlyDepartmentIds(now);
  const hourlyMemberships = user.memberships.filter((m) => hourly.has(m.departmentId));
  if (hourlyMemberships.length === 0) {
    return res.status(403).json({
      error: "Your hours are entered in the end-of-shift report, not at the time clock",
      code: "NOT_HOURLY",
    });
  }

  // Scheduled in a shift that's under way or starts within EARLY_MS?
  const settings = await getSettings();
  const today = parseDate(todayInTimeZone(settings.timeZone))!;
  const slots = await prisma.shiftSlot.findMany({
    where: {
      userId: user.id,
      departmentId: { in: hourlyMemberships.map((m) => m.departmentId) },
      shift: { date: { in: [addDays(today, -1), today, addDays(today, 1)] } },
    },
    include: { shift: true, department: true },
  });
  const match = slots.find((slot) => {
    const { start, end } = shiftWindow(slot.shift.date, slot.shift.startTime, slot.shift.endTime, settings.timeZone);
    return now.getTime() >= start.getTime() - EARLY_MS && now < end;
  });

  // Department: the slot's; else the only hourly one; else none (manager assigns). Unscheduled = flagged.
  const department = match?.department ?? (hourlyMemberships.length === 1 ? hourlyMemberships[0].department : null);
  const [entry] = await Promise.all([
    prisma.timeEntry.create({
      data: {
        userId: user.id,
        departmentId: department?.id ?? null,
        shiftId: match?.shiftId ?? null,
        clockIn: now,
        source: "STATION",
        stationId: station.id,
        flagged: !match,
      },
    }),
    touchStation,
  ]);

  return res.status(201).json({
    action: "IN",
    name: user.name,
    at: entry.clockIn.toISOString(),
    department: department && { id: department.id, name: department.name },
    scheduled: !!match,
  });
});

export default router;

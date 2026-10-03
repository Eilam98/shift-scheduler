import { DepartmentPayRate, PayType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDate, toDateString, zonedTimeToUtc } from "./dates";
import { getSettings } from "./settings";
import { splitTips } from "./tips";

// The pay calculation (PROJECT_SPEC.md "Departments & pay"). One function,
// used by the payroll report and by each worker's "My hours & earnings".
// All money is integer agorot.

/** An entry open longer than this is a missing clock-out; shorter = still working. */
const OPEN_ENTRY_MAX_MS = 16 * 60 * 60_000;

export type PayrollWarning =
  | { kind: "UNAPPROVED" | "NO_DEPARTMENT" | "MISSING_CLOCK_OUT"; entryId: string; userId: string; name: string; date: string; departmentName: string | null }
  | { kind: "NO_RATE"; departmentId: string; departmentName: string };

export interface PayrollDay {
  entryId: string
  date: string; // restaurant calendar date, "YYYY-MM-DD"
  label: string | null; // MORNING / EVENING if tied to a shift
  departmentId: string;
  minutes: number;
  payType: PayType;
  amount: number; // FIXED: pay for the entry; TIPS: tip share
}

export interface PayrollDepartment {
  departmentId: string;
  departmentName: string;
  payType: PayType;
  minutes: number;
  fixedPay: number;
  tipShares: number;
  minimumOwed: number; // TIPS: minutes × guaranteed minimum
  topUp: number;
  bonusRate: number; // agorot / hour
  bonus: number;
  total: number;
}

export interface PayrollWorker {
  userId: string;
  name: string;
  departments: PayrollDepartment[];
  minutes: number;
  fixedPay: number;
  tipShares: number;
  topUp: number;
  bonus: number;
  total: number;
  days: PayrollDay[];
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" → its first day and the next month's first day ("YYYY-MM-DD"), or null. */
export function monthBounds(month: string): { first: string; next: string } | null {
  const m = MONTH.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    first: `${year}-${pad(mon)}-01`,
    next: mon === 12 ? `${year + 1}-01-01` : `${year}-${pad(mon + 1)}-01`,
  };
}

/** The rate in effect on a calendar date: the latest effectiveFrom <= date. */
function rateOn(rates: DepartmentPayRate[], date: string): DepartmentPayRate | undefined {
  const day = parseDate(date)!.getTime();
  return rates.find((r) => r.effectiveFrom.getTime() <= day); // rates are sorted newest first
}

const perHour = (minutes: number, agorotPerHour: number) => Math.round((minutes * agorotPerHour) / 60);

/**
 * Pay for one month ("YYYY-MM"), optionally limited to some users. Hours are
 * attributed to the month of their clock-in (restaurant time).
 */
export async function computePayroll(month: string, userIds?: string[]) {
  const bounds = monthBounds(month);
  if (!bounds) throw new Error("month must be YYYY-MM");
  const settings = await getSettings();
  const tz = settings.timeZone;
  const from = zonedTimeToUtc(bounds.first, "00:00", tz);
  const to = zonedTimeToUtc(bounds.next, "00:00", tz);
  const now = new Date();

  const entryInclude = {
    user: { select: { name: true } },
    department: { select: { name: true } },
    shift: { select: { date: true, label: true } },
  } satisfies Prisma.TimeEntryInclude;

  const [entries, rateRows, memberships] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { clockIn: { gte: from, lt: to }, ...(userIds && { userId: { in: userIds } }) },
      include: entryInclude,
      orderBy: { clockIn: "asc" },
    }),
    prisma.departmentPayRate.findMany({ include: { department: { select: { name: true } } }, orderBy: { effectiveFrom: "desc" } }),
    prisma.departmentMembership.findMany({ ...(userIds && { where: { userId: { in: userIds } } }) }),
  ]);

  // Tip shares: split each shift's pool over ALL its report rows (not only the
  // users asked for), in the same order the report page uses.
  const reportShiftIds = [...new Set(entries.filter((e) => e.source === "REPORT" && e.shiftId).map((e) => e.shiftId!))];
  const [pools, poolRows] = await Promise.all([
    prisma.tipPool.findMany({ where: { shiftId: { in: reportShiftIds } } }),
    prisma.timeEntry.findMany({
      where: { shiftId: { in: reportShiftIds }, source: "REPORT" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const tipShareOf = new Map<string, number>();
  for (const shiftId of reportShiftIds) {
    const rows = poolRows.filter((r) => r.shiftId === shiftId);
    const total = pools.find((p) => p.shiftId === shiftId)?.totalAmount ?? 0;
    const minutes = rows.map((r) => (r.clockOut ? Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60_000) : 0));
    splitTips(total, minutes).forEach((share, i) => tipShareOf.set(rows[i].id, share));
  }

  const ratesByDepartment = new Map<string, DepartmentPayRate[]>();
  for (const r of rateRows) ratesByDepartment.set(r.departmentId, [...(ratesByDepartment.get(r.departmentId) ?? []), r]);
  const departmentNames = new Map(rateRows.map((r) => [r.departmentId, r.department.name]));

  const warnings: PayrollWarning[] = [];
  const missingRate = new Set<string>();
  const workers = new Map<string, PayrollWorker>();
  const zonedDate = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  for (const e of entries) {
    const date = e.shift ? toDateString(e.shift.date) : zonedDate(e.clockIn);
    const base = { entryId: e.id, userId: e.userId, name: e.user.name, date, departmentName: e.department?.name ?? null };
    if (!e.clockOut) {
      if (now.getTime() - e.clockIn.getTime() > OPEN_ENTRY_MAX_MS) warnings.push({ kind: "MISSING_CLOCK_OUT", ...base });
      continue; // still clocked in, or a forgotten clock-out: not paid until closed
    }
    if (!e.departmentId) {
      warnings.push({ kind: "NO_DEPARTMENT", ...base });
      continue;
    }
    if (e.flagged && !e.reviewedAt) warnings.push({ kind: "UNAPPROVED", ...base }); // counted, but listed

    const minutes = Math.round((e.clockOut.getTime() - e.clockIn.getTime()) / 60_000);
    const rate = rateOn(ratesByDepartment.get(e.departmentId) ?? [], date);
    const payType: PayType = rate?.payType ?? (e.source === "REPORT" ? "TIPS" : "FIXED");
    if (payType === "FIXED" && !rate?.hourlyRate) missingRate.add(e.departmentId);

    const worker =
      workers.get(e.userId) ??
      ({ userId: e.userId, name: e.user.name, departments: [], minutes: 0, fixedPay: 0, tipShares: 0, topUp: 0, bonus: 0, total: 0, days: [] } as PayrollWorker);
    workers.set(e.userId, worker);
    let dept = worker.departments.find((d) => d.departmentId === e.departmentId);
    if (!dept) {
      dept = {
        departmentId: e.departmentId,
        departmentName: e.department!.name,
        payType,
        minutes: 0,
        fixedPay: 0,
        tipShares: 0,
        minimumOwed: 0,
        topUp: 0,
        bonusRate: memberships.find((m) => m.userId === e.userId && m.departmentId === e.departmentId)?.hourlyBonus ?? 0,
        bonus: 0,
        total: 0,
      };
      worker.departments.push(dept);
    }

    dept.minutes += minutes;
    let amount: number;
    if (payType === "FIXED") {
      amount = perHour(minutes, rate?.hourlyRate ?? 0);
      dept.fixedPay += amount;
    } else {
      amount = tipShareOf.get(e.id) ?? 0;
      dept.tipShares += amount;
      dept.minimumOwed += perHour(minutes, rate?.minimumHourlyRate ?? 0);
    }
    worker.days.push({ entryId: e.id, date, label: e.shift?.label ?? null, departmentId: e.departmentId, minutes, payType, amount });
  }

  for (const departmentId of missingRate) {
    warnings.push({ kind: "NO_RATE", departmentId, departmentName: departmentNames.get(departmentId) ?? "" });
  }

  // Month totals: top-up per worker per TIPS department, bonus on top of everything.
  for (const w of workers.values()) {
    for (const d of w.departments) {
      d.topUp = d.payType === "TIPS" ? Math.max(0, d.minimumOwed - d.tipShares) : 0;
      d.bonus = perHour(d.minutes, d.bonusRate);
      d.total = d.fixedPay + d.tipShares + d.topUp + d.bonus;
      w.minutes += d.minutes;
      w.fixedPay += d.fixedPay;
      w.tipShares += d.tipShares;
      w.topUp += d.topUp;
      w.bonus += d.bonus;
      w.total += d.total;
    }
  }

  const list = [...workers.values()].sort((a, b) => a.name.localeCompare(b.name));
  const sum = (key: "minutes" | "fixedPay" | "tipShares" | "topUp" | "bonus" | "total") =>
    list.reduce((n, w) => n + w[key], 0);

  return {
    month,
    timeZone: tz,
    isCurrentMonth: zonedDate(now).startsWith(month),
    workers: list,
    totals: {
      minutes: sum("minutes"),
      fixedPay: sum("fixedPay"),
      tipShares: sum("tipShares"),
      topUp: sum("topUp"),
      bonus: sum("bonus"),
      total: sum("total"),
    },
    warnings,
  };
}

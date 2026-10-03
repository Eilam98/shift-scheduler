import { PayType } from "@prisma/client";
import { cached, invalidate } from "./cache";
import { prisma } from "./prisma";

const PAY_TYPES_KEY = "payTypes";

/** Each department's pay type at `now`, from the rate history (latest effectiveFrom <= now). */
async function loadPayTypes(now: Date): Promise<Map<string, PayType>> {
  const rates = await prisma.departmentPayRate.findMany({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });
  const current = new Map<string, PayType>();
  for (const rate of rates) {
    if (!current.has(rate.departmentId)) current.set(rate.departmentId, rate.payType);
  }
  return current;
}

/** Current pay types are read on most requests: cached for a minute. A past date isn't cached. */
const payTypesAt = (now?: Date) => (now ? loadPayTypes(now) : cached(PAY_TYPES_KEY, 60_000, () => loadPayTypes(new Date())));

/** Call after changing pay rates (step 8). */
export const invalidatePayTypes = () => invalidate(PAY_TYPES_KEY);

async function departmentIdsPaid(payType: PayType, now?: Date): Promise<Set<string>> {
  const current = await payTypesAt(now);
  return new Set([...current].filter(([, type]) => type === payType).map(([id]) => id));
}

/** Departments currently paid hourly (FIXED) — the ones that clock in at the station. */
export const hourlyDepartmentIds = (now?: Date) => departmentIdsPaid("FIXED", now);

/** Departments currently paid from tips — their hours come from the end-of-shift report. */
export const tipsDepartmentIds = (now?: Date) => departmentIdsPaid("TIPS", now);

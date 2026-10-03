import { PayType } from "@prisma/client";
import { prisma } from "./prisma";

/** Each department's CURRENT pay type, from the rate history (latest effectiveFrom <= now). */
async function currentPayTypes(now = new Date()): Promise<Map<string, PayType>> {
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

async function departmentIdsPaid(payType: PayType, now?: Date): Promise<Set<string>> {
  const current = await currentPayTypes(now);
  return new Set([...current].filter(([, type]) => type === payType).map(([id]) => id));
}

/** Departments currently paid hourly (FIXED) — the ones that clock in at the station. */
export const hourlyDepartmentIds = (now?: Date) => departmentIdsPaid("FIXED", now);

/** Departments currently paid from tips — their hours come from the end-of-shift report. */
export const tipsDepartmentIds = (now?: Date) => departmentIdsPaid("TIPS", now);

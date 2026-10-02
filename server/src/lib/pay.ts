import { prisma } from "./prisma";

/**
 * Departments whose CURRENT pay rate is FIXED (hourly) — the ones that clock
 * in at the station. Uses the rate history: the latest effectiveFrom <= now.
 */
export async function hourlyDepartmentIds(now = new Date()): Promise<Set<string>> {
  const rates = await prisma.departmentPayRate.findMany({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });
  const current = new Map<string, string>();
  for (const rate of rates) {
    if (!current.has(rate.departmentId)) current.set(rate.departmentId, rate.payType);
  }
  return new Set([...current].filter(([, payType]) => payType === "FIXED").map(([id]) => id));
}

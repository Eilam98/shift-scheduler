import { Prisma, PrismaClient } from "@prisma/client";

// Creating in-app notifications (PROJECT_SPEC.md "Scheduling"). Notifications
// are written in the same transaction as the change that caused them, so one
// is only stored if the change is. `actorId` — whoever made the change — is
// never notified about their own action.

type Tx = Prisma.TransactionClient;

/** Is this department's week posted? (Changes to drafts notify nobody.) */
export async function isWeekPosted(
  db: Tx | PrismaClient,
  scheduleId: string,
  departmentId: string
): Promise<boolean> {
  const week = await db.departmentSchedule.findUnique({
    where: { scheduleId_departmentId: { scheduleId, departmentId } },
  });
  return week?.status === "POSTED";
}

/**
 * A department's week was just posted: tell everyone who has a shift in it.
 * Returns the rows created (to push to phones once the transaction commits).
 */
export async function notifyWeekPosted(
  tx: Tx,
  { scheduleId, departmentId, actorId }: { scheduleId: string; departmentId: string; actorId: string }
) {
  const slots = await tx.shiftSlot.findMany({
    where: { departmentId, userId: { not: null }, shift: { scheduleId } },
    select: { userId: true },
    distinct: ["userId"],
  });

  const rows = slots
    .map((s) => s.userId!)
    .filter((userId) => userId !== actorId)
    .map((userId) => ({ userId, type: "SCHEDULE_POSTED" as const, departmentId, scheduleId }));
  await tx.notification.createMany({ data: rows });
  return rows;
}

/**
 * Notifications for a slot changing hands (old → new, either may be null) in a
 * POSTED week: SHIFT_REMOVED for the old person, SHIFT_ADDED for the new one.
 * Returns rows to create (none for a no-op) — the caller writes them in the
 * same batch transaction as the slot change, to keep database round trips low.
 */
export function assignmentNotifications({
  slot,
  oldUserId,
  newUserId,
  actorId,
}: {
  slot: { departmentId: string; shiftId: string; shift: { scheduleId: string } };
  oldUserId: string | null;
  newUserId: string | null;
  actorId: string;
}): Prisma.NotificationCreateManyInput[] {
  if (oldUserId === newUserId) return [];
  const base = { departmentId: slot.departmentId, scheduleId: slot.shift.scheduleId, shiftId: slot.shiftId };
  const data: Prisma.NotificationCreateManyInput[] = [];
  if (oldUserId && oldUserId !== actorId) data.push({ ...base, userId: oldUserId, type: "SHIFT_REMOVED" });
  if (newUserId && newUserId !== actorId) data.push({ ...base, userId: newUserId, type: "SHIFT_ADDED" });
  return data;
}

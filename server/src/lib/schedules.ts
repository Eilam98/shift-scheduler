import { prisma } from "./prisma";
import { addDays } from "./dates";

/**
 * Create the week if it doesn't exist yet: the Schedule row, one MORNING +
 * one EVENING Shift per day (times from ShiftTemplate), and a DRAFT
 * DepartmentSchedule for every department. Idempotent — an existing week only
 * gets DepartmentSchedules for departments added since. Returns the schedule
 * and whether it was just created.
 */
export async function ensureWeek(weekStart: Date) {
  const [existing, templates, departments] = await Promise.all([
    prisma.schedule.findUnique({ where: { weekStartDate: weekStart } }),
    prisma.shiftTemplate.findMany(),
    prisma.department.findMany({ select: { id: true } }),
  ]);

  if (existing) {
    await prisma.departmentSchedule.createMany({
      data: departments.map((d) => ({ scheduleId: existing.id, departmentId: d.id })),
      skipDuplicates: true,
    });
    return { schedule: existing, created: false };
  }

  const shifts = [];
  for (let day = 0; day < 7; day++) {
    for (const template of templates) {
      shifts.push({
        date: addDays(weekStart, day),
        label: template.label,
        startTime: template.defaultStartTime,
        endTime: template.defaultEndTime,
      });
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      weekStartDate: weekStart,
      shifts: { create: shifts },
      departmentSchedules: { create: departments.map((d) => ({ departmentId: d.id })) },
    },
  });
  return { schedule, created: true };
}

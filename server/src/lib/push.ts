import webpush from "web-push";
import { Language, NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { toDateString, addDays } from "./dates";
import { getSettings } from "./settings";

// Phone push notifications (Web Push). The in-app notification rows stay the
// source of truth; this sends the same events to every device a recipient
// turned notifications on for. Sending never blocks or fails the request.

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
export const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
} else {
  console.warn("Push notifications are off: set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in server/.env");
}
export const vapidPublicKey = VAPID_PUBLIC_KEY ?? null;

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** Send to every subscribed device of these users. Subscriptions the push service says are gone get deleted. */
export async function sendPush(messages: { userId: string; message: PushMessage }[]): Promise<void> {
  if (!pushEnabled || messages.length === 0) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(messages.map((m) => m.userId))] } },
  });
  await Promise.all(
    subscriptions.flatMap((sub) =>
      messages
        .filter((m) => m.userId === sub.userId)
        .map(async ({ message }) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(message),
              { TTL: 24 * 60 * 60 }
            );
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }); // unsubscribed / expired
            } else {
              console.error("Push failed", status ?? err);
            }
          }
        })
    )
  );
}

// ---------- Text for the notification types, in the recipient's language ----------

const DEPARTMENT_HE: Record<string, string> = {
  Waiters: "מלצרים",
  Hostesses: "מארחות",
  Bar: "בר",
  "Shift Managers": "אחמ״שים",
};
const SHIFT_LABEL = { HE: { MORNING: "בוקר", EVENING: "ערב" }, EN: { MORNING: "Morning", EVENING: "Evening" } } as const;
const LOCALE = { HE: "he-IL", EN: "en-GB" } as const;

function text(
  lang: Language,
  type: NotificationType,
  v: { department: string; week: string; day: string; shift: string }
): { title: string; body: string } {
  if (lang === "HE") {
    if (type === "SCHEDULE_POSTED") return { title: "הסידור פורסם", body: `סידור ${v.department} לשבוע ${v.week} פורסם` };
    if (type === "SHIFT_ADDED") return { title: "שובצת למשמרת", body: `משמרת ${v.shift} ב${v.day} (${v.department})` };
    return { title: "הוסרת ממשמרת", body: `משמרת ${v.shift} ב${v.day} (${v.department})` };
  }
  if (type === "SCHEDULE_POSTED") return { title: "Schedule posted", body: `The ${v.department} schedule for ${v.week} was posted` };
  if (type === "SHIFT_ADDED") return { title: "Added to a shift", body: `${v.shift} shift on ${v.day} (${v.department})` };
  return { title: "Removed from a shift", body: `${v.shift} shift on ${v.day} (${v.department})` };
}

/**
 * Push the given notification rows (just created) to their recipients'
 * phones. Call after the transaction that created them has committed.
 */
export async function pushNotifications(
  rows: { userId: string; type: NotificationType; departmentId: string; scheduleId: string; shiftId?: string | null }[]
): Promise<void> {
  if (!pushEnabled || rows.length === 0) return;
  const [settings, users, departments, schedules, shifts] = await Promise.all([
    getSettings(),
    prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, language: true } }),
    prisma.department.findMany({ where: { id: { in: rows.map((r) => r.departmentId) } } }),
    prisma.schedule.findMany({ where: { id: { in: rows.map((r) => r.scheduleId) } } }),
    prisma.shift.findMany({ where: { id: { in: rows.flatMap((r) => (r.shiftId ? [r.shiftId] : [])) } } }),
  ]);

  const messages = rows.map((row) => {
    const lang = users.find((u) => u.id === row.userId)?.language ?? settings.defaultLanguage;
    const locale = LOCALE[lang];
    const departmentName = departments.find((d) => d.id === row.departmentId)?.name ?? "";
    const schedule = schedules.find((s) => s.id === row.scheduleId)!;
    const shift = shifts.find((s) => s.id === row.shiftId);
    const weekStart = schedule.weekStartDate;
    const week = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(weekStart, addDays(weekStart, 6));
    const day = shift
      ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(shift.date)
      : "";
    const { title, body } = text(lang, row.type, {
      department: lang === "HE" ? (DEPARTMENT_HE[departmentName] ?? departmentName) : departmentName,
      week,
      day,
      shift: shift ? SHIFT_LABEL[lang][shift.label] : "",
    });
    return { userId: row.userId, message: { title, body, url: `/schedule/${row.departmentId}?week=${toDateString(weekStart)}` } };
  });
  await sendPush(messages);
}

/** Fire-and-forget wrapper: push must never slow down or break the request that caused it. */
export function pushInBackground(rows: Parameters<typeof pushNotifications>[0]) {
  pushNotifications(rows).catch((err) => console.error("Push failed", err));
}

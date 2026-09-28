// Every UI string, in Hebrew (the default) and English. Keys are flat
// "area.name" strings; `{name}` placeholders are filled in by t().
// Hebrew is the source of truth for the key list: `en` must have exactly the
// same keys, which TypeScript checks through Record<MessageKey, string>.

import type { Language } from '../types'

const he = {
  'app.name': 'מסדר משמרות',
  'common.loading': 'טוען…',
  'common.cancel': 'ביטול',
  'common.save': 'שמירה',
  'common.saving': 'שומר…',
  'common.edit': 'עריכה',
  'common.done': 'סגירה',
  'common.logout': 'התנתקות',
  'common.email': 'אימייל',

  'nav.main': 'ניווט ראשי',
  'nav.home': 'בית',
  'nav.schedules': 'סידורים',
  'nav.workers': 'עובדים',
  'nav.profile': 'פרופיל',

  'role.restaurantManager': 'מנהל/ת מסעדה',
  'role.departmentManager': 'מנהל/ת מחלקה',
  'role.worker': 'עובד/ת',

  // Seeded department names (stored in English in the DB).
  'department.Waiters': 'מלצרים',
  'department.Hostesses': 'מארחות',
  'department.Bar': 'בר',
  'department.Shift Managers': 'אחמ״שים',
  'department.worksIn': 'מחלקות',
  'department.manages': 'מנהל/ת',

  'language.HE': 'עברית',
  'language.EN': 'English',

  'login.title': 'כניסה',
  'login.submit': 'כניסה',
  'login.submitting': 'נכנסים…',

  'password.label': 'סיסמה',
  'password.hint': 'לפחות 8 תווים, עם אות אחת ומספר אחד לפחות.',
  'password.forcedTitle': 'בחירת סיסמה חדשה',
  'password.forcedIntro': 'שלום {name}. נכנסת עם סיסמה זמנית — יש לבחור סיסמה אישית כדי להמשיך.',
  'password.temporary': 'סיסמה זמנית',
  'password.current': 'סיסמה נוכחית',
  'password.new': 'סיסמה חדשה',
  'password.confirm': 'אימות הסיסמה החדשה',
  'password.save': 'שמירת הסיסמה',
  'password.mismatch': 'הסיסמאות החדשות אינן תואמות.',
  'password.sameAsCurrent': 'יש לבחור סיסמה שונה מהסיסמה הנוכחית.',
  'password.changeTitle': 'שינוי סיסמה',
  'password.changed': 'הסיסמה שונתה.',

  'home.welcome': 'שלום, {name}',
  'home.editSchedules': 'עריכת סידורים',

  'profile.title': 'פרופיל',
  'profile.language': 'שפה',
  'profile.languageDefault': 'ברירת המחדל של המסעדה ({language})',

  'workers.title': 'עובדים',
  'workers.add': '+ הוספת עובד/ת',
  'workers.addTitle': 'הוספת עובד/ת',
  'workers.adding': 'מוסיף…',
  'workers.fullName': 'שם מלא',
  'workers.newPassword': 'חדשה',
  'workers.added': '{name} נוסף/ה.',
  'workers.shareDetails': 'יש למסור את פרטי הכניסה:',
  'workers.firstLogin': 'בכניסה הראשונה תתבקש בחירת סיסמה אישית.',
  'workers.inactive': 'לא פעיל/ה',
  'workers.managesChip': 'מנהל/ת {department}',

  'picker.worksIn': 'עובד/ת במחלקות',
  'picker.manages': 'מנהל/ת את המחלקה',
  'picker.noDepartment': 'אף מחלקה',
  'picker.hint': 'אפשר לנהל מחלקה אחת לכל היותר, גם בלי לעבוד בה.',

  'schedule.title': 'סידור {department}',
  'schedule.titleGeneric': 'סידור עבודה',
  'schedule.department': 'מחלקה',
  'schedule.prevWeek': 'השבוע הקודם',
  'schedule.nextWeek': 'השבוע הבא',
  'schedule.posted': 'פורסם',
  'schedule.draft': 'טיוטה',
  'schedule.noWeek': 'עדיין אין סידור לשבוע הזה.',
  'schedule.createHint': 'יצירת השבוע מוסיפה משמרת בוקר ומשמרת ערב לכל יום, לפי שעות ברירת המחדל.',
  'schedule.create': 'יצירת השבוע',
  'schedule.creating': 'יוצר…',

  'shift.MORNING': 'בוקר',
  'shift.EVENING': 'ערב',
  'shift.slot': 'עמדה במשמרת {shift}',
  'shift.empty': '— פנוי —',
  'shift.removeSlot': 'הסרת עמדה',
  'shift.addSlot': '+ הוספת עמדה',
  'shift.noSlots': 'אין עמדות עדיין',
  'shift.nobody': 'אין שיבוצים',
  'shift.open': 'עמדה פנויה',

  'error.generic': 'משהו השתבש. נסו שוב.',
  'error.server': 'שגיאת שרת. נסו שוב בעוד רגע.',
  'error.INVALID_CREDENTIALS': 'אימייל או סיסמה שגויים',
  'error.ACCOUNT_DEACTIVATED': 'החשבון הזה הושבת',
  'error.INVALID_PASSWORD': 'הסיסמה חייבת לכלול לפחות 8 תווים, אות ומספר',
  'error.WRONG_CURRENT_PASSWORD': 'הסיסמה הנוכחית שגויה',
  'error.EMAIL_TAKEN': 'כבר קיים משתמש עם האימייל הזה',
  'error.NOT_IN_DEPARTMENT': 'העובד/ת לא שייך/ת למחלקה הזו',
  'error.ALREADY_IN_SHIFT': '{name} כבר משובץ/ת במשמרת הזו ({department})',
  'error.SCHEDULE_NOT_POSTED': 'הסידור הזה עוד לא פורסם',
} satisfies Record<string, string>

export type MessageKey = keyof typeof he

const en: Record<MessageKey, string> = {
  'app.name': 'Shift Organizer',
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.edit': 'Edit',
  'common.done': 'Done',
  'common.logout': 'Log out',
  'common.email': 'Email',

  'nav.main': 'Main navigation',
  'nav.home': 'Home',
  'nav.schedules': 'Schedules',
  'nav.workers': 'Workers',
  'nav.profile': 'Profile',

  'role.restaurantManager': 'Restaurant manager',
  'role.departmentManager': 'Department manager',
  'role.worker': 'Worker',

  'department.Waiters': 'Waiters',
  'department.Hostesses': 'Hostesses',
  'department.Bar': 'Bar',
  'department.Shift Managers': 'Shift Managers',
  'department.worksIn': 'Works in',
  'department.manages': 'Manages',

  'language.HE': 'עברית',
  'language.EN': 'English',

  'login.title': 'Log in',
  'login.submit': 'Log in',
  'login.submitting': 'Logging in…',

  'password.label': 'Password',
  'password.hint': 'At least 8 characters, with at least one letter and one number.',
  'password.forcedTitle': 'Choose a new password',
  'password.forcedIntro': "Hi {name}. You're using a temporary password — set your own to continue.",
  'password.temporary': 'Temporary password',
  'password.current': 'Current password',
  'password.new': 'New password',
  'password.confirm': 'Confirm new password',
  'password.save': 'Save new password',
  'password.mismatch': 'The new passwords do not match.',
  'password.sameAsCurrent': 'Choose a password different from your current one.',
  'password.changeTitle': 'Change password',
  'password.changed': 'Your password was changed.',

  'home.welcome': 'Welcome, {name}',
  'home.editSchedules': 'Edit schedules',

  'profile.title': 'Profile',
  'profile.language': 'Language',
  'profile.languageDefault': 'Restaurant default ({language})',

  'workers.title': 'Workers',
  'workers.add': '+ Add worker',
  'workers.addTitle': 'Add worker',
  'workers.adding': 'Adding…',
  'workers.fullName': 'Full name',
  'workers.newPassword': 'New',
  'workers.added': '{name} was added.',
  'workers.shareDetails': 'Share these login details with them:',
  'workers.firstLogin': "They'll choose their own password on first login.",
  'workers.inactive': 'Inactive',
  'workers.managesChip': 'Manages {department}',

  'picker.worksIn': 'Works in',
  'picker.manages': 'Manages',
  'picker.noDepartment': 'No department',
  'picker.hint': 'A person can manage at most one department, whether or not they work in it.',

  'schedule.title': '{department} schedule',
  'schedule.titleGeneric': 'Schedule',
  'schedule.department': 'Department',
  'schedule.prevWeek': 'Previous week',
  'schedule.nextWeek': 'Next week',
  'schedule.posted': 'Posted',
  'schedule.draft': 'Draft',
  'schedule.noWeek': 'No schedule for this week yet.',
  'schedule.createHint':
    'Creating it adds a morning and evening shift for every day, using the default shift times.',
  'schedule.create': 'Create this week',
  'schedule.creating': 'Creating…',

  'shift.MORNING': 'Morning',
  'shift.EVENING': 'Evening',
  'shift.slot': '{shift} slot',
  'shift.empty': '— Empty —',
  'shift.removeSlot': 'Remove slot',
  'shift.addSlot': '+ Add slot',
  'shift.noSlots': 'No slots yet',
  'shift.nobody': 'Nobody scheduled',
  'shift.open': 'Open slot',

  'error.generic': 'Something went wrong. Please try again.',
  'error.server': 'Server error. Please try again in a moment.',
  'error.INVALID_CREDENTIALS': 'Invalid email or password',
  'error.ACCOUNT_DEACTIVATED': 'This account has been deactivated',
  'error.INVALID_PASSWORD': 'Password must be at least 8 characters and include a letter and a number',
  'error.WRONG_CURRENT_PASSWORD': 'Current password is incorrect',
  'error.EMAIL_TAKEN': 'A user with this email already exists',
  'error.NOT_IN_DEPARTMENT': "That worker isn't in this department",
  'error.ALREADY_IN_SHIFT': '{name} already works this shift ({department})',
  'error.SCHEDULE_NOT_POSTED': "This schedule hasn't been posted yet",
}

export const messages: Record<Language, Record<MessageKey, string>> = { HE: he, EN: en }

/** Intl locale per language — used for dates and sorting. */
export const LOCALES: Record<Language, string> = { HE: 'he-IL', EN: 'en-GB' }

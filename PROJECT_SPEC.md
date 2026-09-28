# Shift Organizer — Full Project Spec

Source of truth for what the app should be. CLAUDE.md has the condensed conventions and current progress; this file has the product rules, the target data model, every page, and the build order. When a decision changes, update this file first.

## Product
A shift-scheduling, time-tracking and pay app for **one restaurant**. It runs as a responsive web app on **desktop and phone** (installable on iPhone as a PWA). **Hebrew is the default language (right-to-left)**; English can be chosen per user, and the restaurant default is set in settings.

## Roles
- **Restaurant Manager** — exactly one. Has every department manager's permissions for every department, creates workers, sets pay and settings. Also acts as the manager of the **Shift Managers** department (posts its weekly schedule).
- **Department Manager** — can manage **one or more** departments, but each department has **at most one** manager (the restaurant manager aside, who manages everything). Managing a department is **independent of working in it** (e.g. a shift manager can manage the Bar without being a bartender). Can create/edit the department's schedule, post it, and swap people between shifts.
- **Worker** — works in one or more departments. Submits availability, sees posted schedules, sees their own hours and earnings.
- **Shift manager** — a member of the Shift Managers department. Any shift manager can fill in the end-of-shift report (hours of tip workers + the shift's tip pool).

## Departments & pay
Departments: **Waiters, Hostesses, Bar, Shift Managers**.

Each department has a pay rate, with history (`effectiveFrom`) so past months stay correct:
- **FIXED** — hourly rate (e.g. Hostesses, Shift Managers).
- **TIPS** — paid from tips, with an optional **guaranteed minimum per hour** ("completion", e.g. 70 NIS/hour) (e.g. Waiters, Bar).

Rules:
- Everyone in a department earns the department rate; a specific worker can get an extra **hourly bonus** in a specific department. The bonus × hours is **always added on top** (also on top of tips and top-up).
- **Tip pool:** one pool **per shift, shared by all tip-based workers** in that shift (waiters + bartenders together), split by hours worked.
- **Top-up is checked per month, per worker, per department:** if (tip shares for that department's hours) < (hours × department minimum), the restaurant pays the difference. Example: 100 h as a waiter, 6,000 NIS tips, minimum 70 → 7,000 − 6,000 = **1,000 NIS top-up**.
- Money is stored as **integer agorot** (70 NIS = `7000`) — never floats.

## Time tracking
- **FIXED-pay departments** clock in/out on a **restaurant device only** (the "time clock station"), identified by a personal **PIN**. Workers' own phones cannot clock in.
- **TIPS departments** don't clock in: at the end of each shift a shift manager enters each tip worker's hours in the **end-of-shift report**, plus the shift's total tips.
- Clocking in without being scheduled is **allowed but flagged** for the department manager to review on the Attendance page. Managers can correct entries (e.g. missed clock-out).

## Scheduling
- A `Schedule` is one week, **Sunday–Saturday**. Every day has exactly two shifts: **MORNING** and **EVENING** (default times from `ShiftTemplate`, overridable per shift).
- A `Shift` is shared by all departments; each department staffs it with its own `ShiftSlot` rows (empty or filled by one worker). No stored "required count" — managers add/remove slots.
- A slot can only be filled by a **member** of its department; a person can hold **one slot per shift** across all departments.
- Posting is **per department per week** (`DepartmentSchedule.status` DRAFT/POSTED). Workers see a department's week (the whole team, all names) **only once it is posted**. Posting with empty slots is allowed after a warning; a manager can unpost.
- Posted weeks **stay editable** — changes are live for workers.
- **Notifications (in-app):** when a week is posted, everyone with a shift in it is notified; after posting, a worker added to or removed from a slot is notified (nobody is notified of their own change; drafts notify nobody). Stored as structured rows and translated on display. Phone push (Web Push) reuses them in step 9.
- Only department managers (and the restaurant manager) change a schedule, including swaps. Later: a **Request box** where workers ask for a swap and managers approve.

## Availability
- Submitted per (date, MORNING/EVENING), independent of `Shift` rows. **Three levels:** can / prefer not / can't, plus an optional note. A week opens with every shift on "can"; the worker changes what differs and submits all 14 at once. No minimum number of shifts.
- **Deadline:** Wednesday 23:59 (Israel time) before the week starts *(for the week starting Sunday S, the deadline is Wednesday S−4 at 23:59; the week locks when that minute ends)*. After the deadline the worker can't submit or change it. The restaurant manager can change the deadline day/time in settings.
- **Workers' submissions (הגשות העובדים):** a manager sees the submissions of everyone who works in a department they manage (restaurant manager: everyone) and **can change them at any time, even after the deadline** — e.g. a worker who missed it contacts the manager outside the app. A submission is per person, so a change applies in every department the worker belongs to. Changes by a manager are marked (`updatedById`).
- Managers see availability next to names while building the schedule (✓ can, ~ prefer not, ? no answer, ✗ can't); it informs, it doesn't block.

## Settings & language
- `RestaurantSettings` (one row): availability deadline day + time, default language (HE), time zone (`Asia/Jerusalem`), default shift times.
- `User.language` optional override of the default.
- All UI text goes through translations (HE + EN); layouts use logical CSS (start/end, not left/right) so RTL works.
- A **עברית / English** toggle sits at the top right of every page (fixed position and order in both directions). Logged in, it saves the user's language; logged out, it's remembered on the device.

## Target data model (Prisma)
Status: ✅ built · 🔜 planned. Built tables keep their current shape until the migration that changes them.

```prisma
enum ShiftLabel      { MORNING EVENING }
enum ScheduleStatus  { DRAFT POSTED }
enum PayType         { FIXED TIPS }            // ✅
enum TimeEntrySource { STATION MANUAL }        // 🔜
enum Language        { HE EN }                 // ✅

model User {                                    // ✅
  id                     String   @id @default(cuid())
  name                   String
  email                  String   @unique
  passwordHash           String
  pinHash                String?               // station PIN (hashed like passwords) — UI in step 6
  language               Language?             // null = restaurant default
  isActive               Boolean  @default(true) // deactivate instead of delete (blocks login + token); UI 🔜
  isRestaurantManager    Boolean  @default(false)
  requiresPasswordChange Boolean  @default(true)
  createdAt              DateTime @default(now())
}

model Department {                              // ✅ (incl. "Shift Managers")
  id   String @id @default(cuid())
  name String @unique
}

// ✅ Who WORKS in a department (replaced UserDepartment).
model DepartmentMembership {
  id           String @id @default(cuid())
  userId       String
  departmentId String
  hourlyBonus  Int    @default(0)               // agorot/hour, added on top
  @@unique([userId, departmentId])
}

// ✅ Who MANAGES a department (independent of membership).
model DepartmentManager {
  id           String @id @default(cuid())
  userId       String                           // a user may manage several departments
  departmentId String @unique                   // a department has at most one manager
}

// ✅ rate history per department (seeded with each department's pay type, amounts unset until step 8)
model DepartmentPayRate {
  id                String   @id @default(cuid())
  departmentId      String
  effectiveFrom     DateTime                    // date the rate starts
  payType           PayType
  hourlyRate        Int?                        // FIXED: agorot/hour
  minimumHourlyRate Int?                        // TIPS: guaranteed minimum, null = none
  @@unique([departmentId, effectiveFrom])
}

model ShiftTemplate { id, label @unique, defaultStartTime "HH:mm", defaultEndTime }   // ✅
model Schedule { id, weekStartDate @unique (Sunday) }                                 // ✅
model DepartmentSchedule { id, scheduleId, departmentId, status, postedAt; @@unique([scheduleId, departmentId]) } // ✅
model Shift { id, scheduleId, date, label, startTime, endTime; @@unique([scheduleId, date, label]) }            // ✅
model ShiftSlot { id, shiftId, departmentId, userId? }                                // ✅
enum AvailabilityStatus { AVAILABLE PREFER_NOT UNAVAILABLE }                                    // ✅
model Availability { id, userId, date, label, status, note?, updatedAt, updatedById?; @@unique([userId, date, label]) } // ✅

// ✅ one row (seeded)
model RestaurantSettings {
  id                       Int      @id @default(1)
  availabilityDeadlineDay  Int      @default(3)       // 0=Sun … 3=Wed
  availabilityDeadlineTime String   @default("23:59")
  defaultLanguage          Language @default(HE)
  timeZone                 String   @default("Asia/Jerusalem")
}

// 🔜 hours worked — from the station (FIXED depts) or entered by a shift manager (TIPS depts)
model TimeEntry {
  id           String          @id @default(cuid())
  userId       String
  departmentId String                            // pay depends on the department worked
  shiftId      String?                           // the shift it belongs to (null if unscheduled/unknown)
  clockIn      DateTime
  clockOut     DateTime?                         // null = still clocked in
  source       TimeEntrySource
  enteredById  String?                           // shift manager / manager who entered or corrected it
  flagged      Boolean         @default(false)   // e.g. clocked in without a slot → manager reviews
  note         String?
  createdAt    DateTime        @default(now())
}

// 🔜 one tip pool per shift, split by hours among all TIPS-department workers of that shift
model TipPool {
  id          String   @id @default(cuid())
  shiftId     String   @unique
  totalAmount Int                                // agorot
  enteredById String
  createdAt   DateTime @default(now())
}

// ✅ in-app notification (structured — the client builds the text in the reader's language)
enum NotificationType { SCHEDULE_POSTED SHIFT_ADDED SHIFT_REMOVED }
model Notification {
  id           String           @id @default(cuid())
  userId       String                              // recipient
  type         NotificationType
  departmentId String
  scheduleId   String                              // the week
  shiftId      String?                             // SHIFT_ADDED / SHIFT_REMOVED
  readAt       DateTime?
  createdAt    DateTime         @default(now())
  @@index([userId, createdAt])
}

// 🔜 later
model ShiftSwapRequest { id, requesterId, slotId, targetUserId?, status, createdAt }
```

**Migration note:** ✅ done in migration `data_model_v2` — `UserDepartment` was split into `DepartmentMembership` + `DepartmentManager`, copying existing rows (members stayed members; `isManager` rows became manager rows).

## Pages
Every page works on **phone** (single column, bottom tab bar) and **desktop** (side menu, wider layouts — e.g. the week as a 7-day grid). Hebrew/RTL by default.

**Everyone**
1. **Login** ✅
2. **Change password** ✅ — forced on first login; also from Profile (`/profile/password`)
3. **Home** — my next shifts ✅, availability deadline countdown ✅; managers: to-dos (weeks not posted, missing availability, flagged clock-ins)
4. **My shifts** ✅ — upcoming and past 30 days, department, times (posted weeks only)
5. **Team schedule** ✅ — any department's *posted* week, all names, week navigation (same `/schedule` page as the editor, read-only)
6. **Availability** ✅ — a week's 14 shifts, can / prefer not / can't + note; locked after the deadline. Managers get a **הגשות העובדים** toggle on the same page (page 11)
8. **My hours & earnings** — monthly: hours per department, fixed pay, tip shares, top-up, bonus, total
9. **Profile** ✅ — language, change password, my details

**Department managers** (restaurant manager: all departments)

10. **Schedule editor** ✅ (post/unpost, availability next to names)
11. **Workers' submissions (הגשות העובדים)** ✅ — workers × shifts, who hasn't submitted; managers can edit any of their workers' weeks at any time
12. **Attendance** — station clock-ins for the department: fix missed clock-outs, review flagged entries

**Shift managers**

13. **End-of-shift report** — pick a shift; enter hours for each tip-based worker and the shift's total tips; shows each person's share

**Restaurant device**

7. **Time clock station** — a device the restaurant manager sets up once; PIN keypad; clock in/out for FIXED-pay departments

**Restaurant manager only**

14. **Workers** ✅ (+ "works in" and "manages" chosen separately, PIN, per-department hourly bonus, edit details, deactivate, reset password)
15. **Departments & pay** — pay type, rate/minimum, effective date
16. **Restaurant settings** ✅ — availability deadline, default language, default shift times (new weeks only)
17. **Payroll report** — month × all workers: hours, pay, tips, top-up, bonus; export CSV/Excel

**Later**

18. **Request box** — workers request swaps, managers approve/reject

**Everyone**

19. **Notifications** ✅ — bell with unread count in the top bar (every page); list at `/notifications`, opening it marks all read; each item links to the week

## Build order
1. ✅ Scaffolding, database, seed, auth, worker management, schedule editor.
2. ✅ **Data model v2:** `DepartmentMembership` + `DepartmentManager` (migrate existing data), Shift Managers department, `DepartmentPayRate`, `RestaurantSettings`, `User.isActive/language/pinHash`. Update auth `user` shape, middleware and the Workers page.
3. ✅ **App shell:** i18n (HE default + EN, RTL), responsive navigation (bottom tabs on phone, side menu on desktop). Convert existing pages.
4. ✅ **Posting + Team schedule + My shifts** (+ in-app notifications).
5. ✅ **Availability** with deadline (+ Restaurant settings page).
6. **Time clock station + Attendance** (PIN, flagged entries).
7. **End-of-shift report** (manual hours + tip pool).
8. **Departments & pay, My hours & earnings, Payroll report.**
9. **PWA + deployment** (installable on iPhone, hosted server/client; Web Push for the existing notifications).
10. Later: Request box.

## Auth API (built)

### Password rules
- Hashed with bcrypt (12 rounds). Minimum 8 characters, at least one letter and one number.
- No public self-registration — accounts are only created by the restaurant manager.
- The first restaurant-manager account is created by the seed script (`server/src/prisma/seed.ts`, `npx prisma db seed`, details from `server/.env`), not an API route.
- New users get `requiresPasswordChange: true`; the frontend forces a password change on first login.

### JWT
- Payload `{ userId }` only — roles/departments are re-fetched from the DB on every request. Expiry 7 days. Secret `JWT_SECRET` in `server/.env`.

### Routes
- **POST /api/auth/login** `{ email, password }` → 200 `{ token, user }` · 401 `{ error: "Invalid email or password" }`
- **GET /api/auth/me** → `{ user }`
- **PATCH /api/auth/password** `{ currentPassword, newPassword }` → `{ success: true }`, clears `requiresPasswordChange`
- **PATCH /api/auth/language** `{ language: "HE" | "EN" | null }` → `{ user }` (null = restaurant default)
- **GET /api/settings/public** (no login) → `{ defaultLanguage }` — used by the login screen
- Errors the UI shows carry a stable `code` for translation: `INVALID_CREDENTIALS`, `ACCOUNT_DEACTIVATED`, `INVALID_PASSWORD`, `WRONG_CURRENT_PASSWORD`, `EMAIL_TAKEN`, `NOT_IN_DEPARTMENT`, `ALREADY_IN_SHIFT` (`params: { name, department }`), `SCHEDULE_NOT_POSTED`, `DEPARTMENT_HAS_MANAGER` (`params: { name, department }`)
- `user` shape: `{ id, name, email, isRestaurantManager, requiresPasswordChange, language, memberships: [{ departmentId, departmentName }], managedDepartments: [{ departmentId, departmentName }] }`.
- Login of a deactivated user (`isActive: false`) → 403 (checked after the password); their existing tokens get 401.
- User management, departments, schedules, shifts and slots routes: see CLAUDE.md "Folder structure".

## Known simplifications (worth mentioning as "what I'd improve" in an interview)
- `startTime`/`endTime` stored as `"HH:mm"` strings — fine for fixed morning/evening shifts; would move to real time arithmetic for overlap detection.
- Slot capacity has no DB-level enforcement — enforced in the Express route layer.
- Single restaurant (no `Restaurant` table / multi-tenancy).
- Department names are stored once (English) and translated client-side for the seeded names; renamed/new departments show as typed.
- Desktop schedule shows the full 7-day grid only on very wide screens (`2xl`); narrower desktops use 2–4 day columns so slot pickers stay usable.

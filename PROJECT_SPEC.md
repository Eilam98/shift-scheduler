# Shift Scheduler — Full Project Spec

This file consolidates every planning decision made before development started. Claude Code should read this alongside CLAUDE.md — CLAUDE.md has the condensed conventions, this file has the full data model and API contract to build against.

## Roles
- **Restaurant Manager** — global, only one per restaurant. Can create workers, assign their departments, edit any schedule.
- **Department Manager** — a worker "extended" to manage exactly one department (e.g. floor manager -> Waiters, host manager -> Hostesses, bar manager -> Bar). Can create/edit/delete shifts and slots only for their own department, and posts their department's schedule.
- **Worker** — belongs to one or more departments. Submits availability. Can view any department's *posted* schedule, but not drafts.

## Departments
Waiters, Hostesses, Bartenders. A worker can belong to more than one department. `isManager` is scoped per department (a `UserDepartment` join row), not global to the user.

## Scheduling model
- A `Schedule` is a container for one calendar week (`weekStartDate`).
- A `Shift` is one date + label (`MORNING` / `EVENING`), **shared across all departments** — it is not department-specific by itself.
- Each shift has literal `ShiftSlot` rows per department: a slot is either empty (`userId: null`) or filled by one worker. There is no numeric "requiredCount" — a manager adds or removes slot rows manually per shift as needed (no stored defaults).
- `ShiftTemplate` holds a restaurant-wide default start/end time per label (e.g. Morning defaults to 08:00–16:00), which a manager can override per individual shift.
- Posting is **per department per week**, via `DepartmentSchedule.status` (`DRAFT` / `POSTED`). One department can post while another is still in draft, even though they share the same underlying `Shift` rows.
- `Availability` is submitted per (date, label) pair, independent of any `Shift` row — workers submit availability before shifts/schedules for that week exist.

## Prisma schema

```prisma
enum ShiftLabel {
  MORNING
  EVENING
}

enum ScheduleStatus {
  DRAFT
  POSTED
}

model User {
  id                     String   @id @default(cuid())
  name                   String
  email                  String   @unique
  passwordHash           String
  isRestaurantManager    Boolean  @default(false)
  requiresPasswordChange Boolean  @default(true)
  createdAt              DateTime @default(now())

  departments  UserDepartment[]
  slots        ShiftSlot[]
  availability Availability[]
}

model Department {
  id   String @id @default(cuid())
  name String @unique // "Waiters", "Hostesses", "Bar"

  members         UserDepartment[]
  slots           ShiftSlot[]
  departmentWeeks DepartmentSchedule[]
}

model UserDepartment {
  id           String  @id @default(cuid())
  userId       String
  departmentId String
  isManager    Boolean @default(false)

  user       User       @relation(fields: [userId], references: [id])
  department Department @relation(fields: [departmentId], references: [id])

  @@unique([userId, departmentId])
}

model ShiftTemplate {
  id               String     @id @default(cuid())
  label            ShiftLabel @unique
  defaultStartTime String     // "08:00"
  defaultEndTime   String     // "16:00"
}

model Schedule {
  id            String   @id @default(cuid())
  weekStartDate DateTime @unique

  shifts              Shift[]
  departmentSchedules DepartmentSchedule[]
}

model DepartmentSchedule {
  id           String         @id @default(cuid())
  scheduleId   String
  departmentId String
  status       ScheduleStatus @default(DRAFT)
  postedAt     DateTime?

  schedule   Schedule   @relation(fields: [scheduleId], references: [id])
  department Department @relation(fields: [departmentId], references: [id])

  @@unique([scheduleId, departmentId])
}

model Shift {
  id         String     @id @default(cuid())
  scheduleId String
  date       DateTime
  label      ShiftLabel
  startTime  String
  endTime    String

  schedule Schedule    @relation(fields: [scheduleId], references: [id])
  slots    ShiftSlot[]

  @@unique([scheduleId, date, label])
}

model ShiftSlot {
  id           String  @id @default(cuid())
  shiftId      String
  departmentId String
  userId       String?

  shift      Shift      @relation(fields: [shiftId], references: [id])
  department Department @relation(fields: [departmentId], references: [id])
  user       User?      @relation(fields: [userId], references: [id])
}

model Availability {
  id        String     @id @default(cuid())
  userId    String
  date      DateTime
  label     ShiftLabel
  available Boolean    @default(true)
  note      String?

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, date, label])
}
```

## Auth & first feature: manager account / auth system

### Password rules
- Hashed with bcrypt, 10–12 salt rounds.
- Minimum 8 characters, at least one letter and one number.
- No public self-registration — accounts are only created by the restaurant manager.
- The first restaurant-manager account is created via a one-off seed script (`server/src/prisma/seed.ts`, run with `npx prisma db seed`), not an API route.
- New users get `requiresPasswordChange: true`; the frontend forces a password-change screen on first login.

### JWT
- Payload: `{ userId }` only — no roles/departments baked in, since those can change. Middleware re-fetches current role/department data from the DB on every request.
- Expiry: 7 days. Secret in `server/.env` as `JWT_SECRET`.

### Routes

**POST /api/auth/login**
Request: `{ email, password }`
200: `{ token, user: { id, name, email, isRestaurantManager, requiresPasswordChange, departments: [{ departmentId, departmentName, isManager }] } }`
401: `{ error: "Invalid email or password" }`

**GET /api/auth/me** (auth required) — returns the same `user` shape.

**PATCH /api/auth/password** (auth required)
Request: `{ currentPassword, newPassword }` → 200: `{ success: true }`, clears `requiresPasswordChange`.

**POST /api/users** (restaurant-manager only)
Request: `{ name, email, temporaryPassword, departments: [{ departmentId, isManager }] }`
201: created user object (no password hash). 403 if caller isn't the restaurant manager.

**GET /api/users** (restaurant-manager only)
200: `{ users: [{ id, name, email, isRestaurantManager, departments: [...] }] }`

**PATCH /api/users/:id/departments** (restaurant-manager only)
Request: `{ departments: [{ departmentId, isManager }] }` — full replace of that user's department memberships.
200: updated user object.

### Middleware
```ts
// req.user after `authenticate` middleware:
{
  id: string;
  isRestaurantManager: boolean;
  departments: { departmentId: string; isManager: boolean }[];
}
```
- `requireRestaurantManager` — checks `req.user.isRestaurantManager`.
- `requireDepartmentManager(departmentId)` — true if `isRestaurantManager` OR a matching `{ departmentId, isManager: true }` entry. Reuse this for shift/slot routes later.

## Known simplifications (worth mentioning as "what I'd improve" in an interview)
- `startTime`/`endTime` stored as `"HH:mm"` strings rather than proper time values — fine for MVP, would move to real time arithmetic for overlap detection later.
- Slot capacity has no DB-level enforcement (can't easily do "count of related rows ≤ N" in Postgres) — enforced in the Express route layer instead.

## Suggested build order
1. Repo scaffolding: `/client` (Vite + React + TS + Tailwind), `/server` (Express + TS), Prisma init.
2. Wire the Prisma schema above into `server/src/prisma/schema.prisma`, connect to a hosted Postgres DB (e.g. Neon), run the first migration.
3. Seed script for the first restaurant-manager account.
4. Auth: login, `/me`, password change, JWT middleware.
5. Restaurant-manager-only user creation + department assignment routes.
6. Then move on to shift/schedule features.

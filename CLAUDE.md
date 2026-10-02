# Shift Organizer — Project Conventions

`PROJECT_SPEC.md` is the source of truth: product rules (roles, pay, tips, time tracking, availability deadline), the **target** data model (✅ built / 🔜 planned), every page, and the build order. Read it before any feature work; update it first when a decision changes. This file has the condensed conventions and current code layout.

One restaurant · responsive **desktop + phone** (PWA) · **Hebrew default (RTL)** + English.

## Working style
- The developer is learning: build one complete feature at a time, test it, then summarize what was built and the key concepts concisely.
- Git: commit after each finished, verified step. Push to GitHub only when asked. Feature work on `feature/<name>` branches.

## Stack
- Frontend: React (Vite) + TypeScript, Tailwind CSS — responsive (phone + desktop), installable PWA (see "Platforms & language")
- Backend: Express 5 + TypeScript (Express 5 forwards errors thrown in async handlers to the JSON error handler in `server/src/index.ts`)
- Database: PostgreSQL on Neon, via Prisma ORM (v5)
- Auth: Custom JWT (no third-party auth library), passwords hashed with bcrypt 6

## Folder structure
- `/client` — React frontend (Vite + React 19 + TS + Tailwind v4)
  - `vite.config.ts` — proxies `/api` to `http://localhost:4000` in dev, so client code calls `fetch("/api/...")` with no host/port
  - `src/main.tsx` entry (wraps the app in `BrowserRouter` + `AuthProvider` + `I18nProvider`) → `src/App.tsx` gates: `/station` first (time clock device, no login) → Login → ForcedPasswordChange (if `requiresPasswordChange`) → react-router `<Routes>` nested in `AppShell` (`/` Home, `/schedule/:departmentId?` + `?week=YYYY-MM-DD` — one page for everyone: editor + post/unpost + workers panel for the department's managers, read-only drafts for department managers and shift managers, read-only Team schedule for others once posted; no id → first managed, else first own, else first department; tabs for all departments, `/my-shifts`, `/availability` (`?view=team` = הגשות העובדים for managers, `?week=`), `/notifications`, `/attendance` (managers of an hourly department — `user.managesHourly`), `/workers` + `/settings` restaurant-manager only, `/tetris` (everyone), `/more` (phone overflow), `/profile`, `/profile/password`)
  - `src/components/AppShell.tsx` — logged-in layout: bottom tab bar on phone (max `PHONE_TABS` = 5; extra items go behind a "More" tab → `/more`), side menu (start side) on `md:`+. `components/navItems.ts` `navItems(user)` drives the side menu, the tab bar and `/more`. `src/components/icons.tsx` — inline SVG icons (`ChevronStartIcon`/`ChevronEndIcon` flip in RTL)
  - `src/i18n/` — `messages.ts` (HE + EN dictionaries; `en` must have every HE key, TypeScript checks it), `I18nProvider` (picks the language, sets `<html lang dir>`), `useI18n()` → `t(key, params)`, `locale`, `errorMessage(err)`, `departmentName(name)`
  - `src/lib/api.ts` — `api<T>(path, {method, body, headers})` fetch wrapper: adds the Bearer token, throws `ApiError` with the server's message + `code`/`params`. Use it for every API call; show errors with `errorMessage(err)` from `useI18n()`.
  - `src/auth/` — `AuthProvider` (user state, login/logout/changePassword/saveLanguage, restores session via `/me` on load) + `useAuth()` hook
  - `src/pages/` — one component per screen; `src/components/ui.tsx` — shared `Screen` (`title`, `actions`, `wide`), `CenteredScreen` (no nav), `Card`, `TextField`, `Button` (`variant="secondary"`), `ErrorMessage`
  - `src/components/DepartmentPicker.tsx` — per department: "Works here" + "Manager" checkboxes; departments managed by someone else are locked; `AddWorkerForm.tsx`
  - `src/components/LanguageToggle.tsx` — `LanguageBar`: sticky full-width `h-12` strip on every page (AppShell + `CenteredScreen`) with the עברית/English toggle pinned to the physical right (`dir="ltr"`); the side menu sits below it (`top-12`)
  - `src/pages/SchedulePage.tsx` (+ `PostControls`, `assignWorker`) + `src/components/ShiftCard.tsx` (editing; coloured by the selected worker, drop target, "+ name" button) / `ReadOnlyShift.tsx` (team view, your name highlighted)
  - `src/components/StaffingPanel.tsx` — the editor's workers panel (shifts this week, "?" = no availability; click to select, draggable); `src/lib/staffing.ts` — `highlightFor` (HERE / ELSEWHERE / availability), `HIGHLIGHT_CLASSES`, `shiftCounts`, `WORKER_DRAG_TYPE`
  - `src/pages/AvailabilityPage.tsx` + `components/AvailabilityWeekEditor.tsx` (14 shifts × can / prefer not / can't + note; shared by "mine" and a manager editing a worker) + `components/WeekNav.tsx` (shared ‹ week › bar); `src/lib/availability.ts` — status symbols/colours/rank (✓ ~ ? ✗) and `describeDeadline` (restaurant time zone + relative time)
  - `src/pages/SettingsPage.tsx` — deadline day/time, default language (calls `refreshRestaurantLanguage()` from `useI18n`), default shift times, `StationsCard` (activate this browser as the time clock → stores the key, logs out, opens `/station`; revoke)
  - `src/pages/StationPage.tsx` — the time clock: checks its key (`GET /station/me`), clock, 4-digit keypad (auto-submits; physical keyboard works), result message; a revoked key → "not a time clock" screen. `src/lib/station.ts` — station key in `localStorage` (`shift-organizer.station`), sent as `X-Station-Token`
  - `src/pages/AttendancePage.tsx` — week of entries grouped by day, department + "needs attention" filters, inline editor (times as `datetime-local` in restaurant time, department, note, approve, delete), add entry; applies the server's answer immediately, then refetches
  - `src/lib/time.ts` — clock times (ISO) in the restaurant zone: `formatTime`, `zonedDate`, `toZonedInput`, `formatDuration`
  - Workers page: `PinControl` per hourly worker (create / replace PIN, shown once)
  - `src/pages/TetrisPage.tsx` — canvas board + next/hold/score panel, keyboard + on-screen controls (hold-to-repeat), score saved at game over, leaderboard; the game area is `dir="ltr"`. `src/lib/tetris.ts` — the engine as a plain class (`Tetris`: move / rotate with simple wall kicks / tick / softDrop / hardDrop / holdPiece, 7-bag, `gravityMs(level)`), kept in a ref; the page copies score/lines/level/next/hold into state after each action
  - `src/lib/useMyShifts.ts` — `GET /shifts/mine` split into upcoming/past; used by `MyShiftsPage` and Home's next-shifts card (`MyShiftRow`)
  - `src/notifications/` — `NotificationsProvider` (inside AppShell; polls `/notifications/unread-count` every 60s, on focus and on page change) + `useNotifications()`; `NotificationBell` sits on the left of `LanguageBar`
  - `src/lib/dates.ts` — "YYYY-MM-DD" date helpers (`currentWeekStart`, `addDays`, `formatDay(value, locale)`…) — never use `Date` objects for calendar dates
  - `src/lib/password.ts` — `PASSWORD_RULE` (mirrors the server rule; hint text is `t('password.hint')`) + `generateTemporaryPassword()`; `src/lib/roles.ts` — `roleLabel(user)` returns a translation key
  - `src/types.ts` — API response types (mirror the server's response shapes)
  - JWT stored in `localStorage` under `shift-organizer.token`; last UI language under `shift-organizer.language`
- `/server` — Express API
  - `src/prisma/schema.prisma` — data model; `src/prisma/migrations/` — generated SQL migrations (committed, never edit by hand)
  - `src/prisma/seed.ts` — creates departments (+ initial `DepartmentPayRate` with pay type), shift templates, the `RestaurantSettings` row, and the only restaurant manager (details from `.env`)
  - `src/lib/` — shared helpers (`prisma.ts` client, `auth.ts` JWT/bcrypt/password rule, `dates.ts` week/date parsing + `todayInTimeZone` + `zonedTimeToUtc` / `availabilityDeadline` / `isPastDeadline` / `weekStartOf` / `shiftWindow` / `parseZonedDateTime`, `settings.ts` `getSettings()`, `pins.ts` `hashPin` (HMAC with `PIN_SECRET`) / `generateUniquePin`, `stations.ts` station keys (SHA-256 stored), `pay.ts` `hourlyDepartmentIds()` (current pay type FIXED), `users.ts` `departmentRolesInclude` + `toDepartmentRoles` for user responses, `notifications.ts` `notifyWeekPosted` / `isWeekPosted` / `assignmentNotifications`)
  - `src/middleware/auth.ts` — `authenticate`, `requireRestaurantManager`, `requireDepartmentManager(getDepartmentId(req, res))` (use `res.locals` when the department comes from a DB row loaded by earlier middleware, see `routes/slots.ts`), `requireAnyManager`, `canManageDepartment`, `canManageUser(user, targetUserId)` (restaurant manager, or the target works in a department the user manages), `canViewDrafts(user)` (restaurant manager, department managers, members of Shift Managers); `middleware/station.ts` `authenticateStation` (X-Station-Token → `res.locals.station`)
  - `src/routes/` — one router per resource: `auth.ts` (+ `PATCH /language`), `settings.ts` (`GET /public` → `{ defaultLanguage }`, no login; `GET`/`PATCH /` restaurant manager), `availability.ts` (`GET /me?week=` (no week → next open week), `PUT /me/:weekStart` until the deadline, `GET /team?week=&departmentId=` managers, `PUT /users/:userId/:weekStart` managers, any time), `users.ts` (restaurant manager only; body `{ memberDepartmentIds, managedDepartmentIds }`; `POST /:id/pin` → `{ pin }` once), `station.ts` (device: `GET /me`, `POST /punch { pin }`), `stations.ts` (restaurant manager: list / create → key once / revoke), `attendance.ts` (managers: `GET /?week=&departmentId=`, `PATCH`/`DELETE /:id`, `POST /`), `departments.ts` (`GET /api/departments` any logged-in user; `GET /:id/members` dept manager), `schedules.ts` (`POST /` create week — also adds missing DepartmentSchedules to an existing week, `GET /:weekStart/departments/:departmentId` (+ `elsewhere` for editors: this department's workers' slots in other departments that week), `PATCH` same path `{ status }` post/unpost), `shifts.ts` (`GET /mine`, `POST /:shiftId/slots`), `slots.ts` (`PATCH`/`DELETE /:id` — notify when the week is posted), `notifications.ts` (`GET /`, `GET /unread-count`, `POST /read`), `tetris.ts` (`POST /games { score, lines, level }` → keeps the best + counts games, `GET /leaderboard` → top 50 + mine, ties share a rank)

## Environment (`server/.env`, gitignored — template in `server/.env.example`)
- `DATABASE_URL` — Neon **pooled** connection string (host contains `-pooler`), used by the running app
- `DIRECT_URL` — same string without `-pooler`, used by `prisma migrate` (migrations need a direct connection)
- `JWT_SECRET` — long random string; `PIN_SECRET` — another long random string, key for hashing time clock PINs (changing it invalidates every PIN); `PORT` — defaults to 4000
- `SEED_MANAGER_NAME` / `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` — read only by the seed script to create the restaurant manager (temporary password, forced change on first login). Personal data and passwords never go in committed code.
- User IDs are auto-generated cuids — never use national ID numbers or other real-world identifiers as IDs.

## Domain rules (important — enforce these in middleware, not scattered checks)
Full rules in PROJECT_SPEC.md. Key ones:
- Roles: Restaurant Manager (one; has every department manager's permissions; manages the Shift Managers department), Department Manager (can manage several departments — **independent of working in them**; each department has at most one manager, the restaurant manager aside), Worker, Shift manager (member of Shift Managers; any shift manager fills in end-of-shift reports)
- Only the Restaurant Manager can create workers, assign departments/manager roles, set pay and settings
- Membership (`DepartmentMembership`, holds `hourlyBonus`) and management (`DepartmentManager`, `departmentId` unique) are separate tables. Assigning a department that already has another manager → 409 `DEPARTMENT_HAS_MANAGER`. Editing a user's departments keeps existing membership rows so bonuses survive
- Deactivated users (`isActive: false`) can't log in, their tokens are rejected, and they're hidden from slot pickers
- Money is integer agorot (70 NIS = 7000), never floats. Pay rates keep history (`effectiveFrom`)
- Clock-dependent rules (availability deadline, clock-in) use the restaurant time zone `Asia/Jerusalem`, not the server's
- A Department Manager can only create/edit/delete ShiftSlots and Shifts for their own department
- Workers can view any department's schedule, but only once that department's DepartmentSchedule.status = POSTED; department managers, shift managers and the restaurant manager also see drafts (read-only where they can't edit)
- Editor workers panel: selecting a worker colours shifts (green can / yellow prefer not / red can't / blue already in another department that shift / none = no answer); assign by drag (desktop) or the shift's "+ name" button: given slot, else first empty slot, else a new slot. Red asks to confirm; blue and "already here" are refused
- Availability is submitted per (date, shiftLabel), independent of Shift rows, as AVAILABLE / PREFER_NOT / UNAVAILABLE + note; a week is saved whole (14 entries). Workers are locked after the deadline (default Wednesday 23:59 Israel time before the week, configurable; locks when that minute ends). Managers can change submissions of anyone in their departments at any time (`updatedById` set); a submission is per person, so it applies in all their departments. The schedule editor shows ✓ ~ ? ✗ next to names (informs, never blocks)
- Emails are stored and compared lowercase
- Weeks run Sunday–Saturday (`WEEK_START_DAY` in server + client `lib/dates.ts`). Dates are stored as UTC midnight and sent as "YYYY-MM-DD"
- Creating a week (any manager, idempotent) creates the Schedule, 14 Shifts from ShiftTemplate times, and a DRAFT DepartmentSchedule per department
- A slot can only be filled by a member of its department, and a person can hold only one slot per shift across all departments
- Time clock: hourly (current pay type FIXED) departments only. Unique 4-digit PINs (HMAC) generated by the restaurant manager. A station = any browser activated by the restaurant manager (secret key, no login, revocable). Same PIN toggles in/out; server clock; an open entry older than 16 h is left as "missing clock-out"; 5 wrong PINs → 1-minute lock (in memory). Department: the slot under way (or starting within 2 h) → not flagged; else the only hourly department → flagged; else none (flagged, manager assigns). Attendance: managers of hourly departments (restaurant manager: all) see their departments' entries + department-less entries of their workers; manual changes set `enteredById`, approvals `reviewedAt/ById`
- Posted weeks stay editable (live). Notifications: posting → everyone scheduled in that department's week; after posting, add/remove → the people affected. Drafts notify nobody, the actor is never notified. Rows are structured (`type` + ids), text is built client-side via `t('notification.<TYPE>')`

## Conventions
- All API routes under `/api`, RESTful, prefixed by resource (`/api/shifts`, `/api/availability`)
- Validate request bodies with zod before hitting the DB
- Errors a user can hit through the UI also send a stable `code` (+ `params`), e.g. `{ error, code: "EMAIL_TAKEN" }`; the client translates `error.<CODE>` keys and falls back to the English `error` text
- Auth middleware attaches `req.user` with `{ id, isRestaurantManager, memberDepartmentIds: string[], managedDepartmentIds: string[] }`
- Schema changes: edit `schema.prisma`, then `npx prisma migrate dev --name <what_changed>`, and commit the new migration folder together with the schema change
- Migration SQL without a shadow DB (non-interactive shell): `npx prisma migrate diff --from-schema-datasource src/prisma/schema.prisma --to-schema-datamodel src/prisma/schema.prisma --script` (only reads the live DB) → save as `migrations/<timestamp>_<name>/migration.sql` → `npx prisma migrate deploy` → re-run the diff with `--exit-code` to confirm no drift
- Neon's sample table `playing_with_neon` exists in the DB but not in our schema: `migrate diff` always wants to drop it — remove that `DROP TABLE` line from generated SQL; never drop it
- Data-moving migrations: create the SQL first (`migrate dev --create-only`), add the data-copy SQL by hand, wrap it in `BEGIN;`/`COMMIT;`, then apply. Never edit a migration after it's applied
- **Never pass `DATABASE_URL`/`DIRECT_URL` as `--shadow-database-url`** (e.g. to `prisma migrate diff`): the shadow DB gets reset — this wiped the real DB once (restored via Neon). In a non-interactive shell, generate SQL with `migrate diff` against a throwaway Neon branch and apply with `migrate deploy`
- Commit messages: short imperative present tense ("Add shift slot endpoint", not "Added")

## Platforms & language
- Every page must work on phone (single column, bottom tab bar) and desktop (side menu, wider layouts). Build mobile-first, then add `md:`/`lg:` layouts.
- Installable PWA ("Add to Home Screen" in Safari). Later/optional: Capacitor wrap for the App Store.
- All UI text goes through `t()` (add the key to both dictionaries in `src/i18n/messages.ts`) and layouts use logical Tailwind classes (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, `border-e`, `text-start`) — never `left`/`right` — so RTL works. Use `rtl:rotate-180` for direction arrows, and `dir="ltr"` on emails, times and passwords.
- UI language: the user's `language`, else the restaurant default (`RestaurantSettings.defaultLanguage`); logged out: last language used on the device. Seeded department names are stored in English and shown via `departmentName()`.

## Progress
- [x] Server scaffolding, auth + user routes (code)
- [x] Neon database connected; initial migration `init` applied (all tables created)
- [x] Seeded: 3 departments (Waiters, Hostesses, Bar), MORNING/EVENING templates, restaurant manager account (seed is idempotent — safe to re-run)
- [x] Smoke-tested the API: `/api/health`, login (success + 401/400 failures), `/me` with/without token. Note: opening `localhost:4000` itself shows "Cannot GET /" — expected, there is no route at `/`.
- [x] Client scaffolding: `/client` created, Tailwind + `/api` proxy working (test page shows "Server connected")
- [x] Login screen, forced password-change screen, session restore on refresh, logout
- [x] Worker management (`/workers`, restaurant manager): list users, add worker with generated temporary password + departments, edit department assignments
- [ ] Not built yet: delete/deactivate worker, edit name/email, reset a worker's password (no API yet)
- [x] Schedules part 1 — editor: create week, add/remove slots, assign workers (dept manager / restaurant manager)
- [x] Build step 2 — data model v2: migration `data_model_v2` (membership/manager split with data copy, `DepartmentPayRate`, `RestaurantSettings`, `User.pinHash/language/isActive`), Shift Managers department, new auth `user` shape, Workers page "Works in" / "Manages"
- [x] Build step 3 — app shell: i18n (HE default + EN, RTL), `AppShell` navigation (phone tabs / desktop side menu), Profile page (details, language, change password, log out), existing pages converted (Schedule: desktop day grid + restaurant-manager department switcher; Workers: 2 columns on desktop)
- [x] Tweaks after step 3: one manager per department (a user may manage several; migration `one_manager_per_department`), language toggle on every page
- [x] Build step 4 — posting + team schedule + my shifts + in-app notifications (migration `notifications`)
- [x] Build step 5 — availability (3 levels, deadline, הגשות העובדים), restaurant settings page, phone "More" tab (migration `availability_levels`)
- [x] Build step 6 — time clock station (`/station`, PINs, stations in Settings) + Attendance page (migration `time_clock`)
- [x] Schedule editor upgrade: managers + shift managers read drafts, workers panel with availability colours, drag / tap to assign
- [x] Tetris for everyone: best score per person (`TetrisScore`, migration `tetris`) + leaderboard
- [ ] **Next: build step 7 — end-of-shift report** (PROJECT_SPEC.md "Build order"), then: pay & payroll → PWA + deployment
- [ ] Later: edit a single shift's times (shared across departments — decide who may)
- Testing tip: create temporary test users with `@example.test` emails and delete them afterwards (their TetrisScore, TimeEntry (incl. `enteredById`/`reviewedById`), StationDevice (`createdById`), Availability (incl. `updatedById`), Notification, ShiftSlot, DepartmentMembership and DepartmentManager rows first); restore any settings you change; test schedules on a far-future week, deleted afterwards
- Dev latency: each DB round trip from this machine to Neon (US East) is ~300 ms, so a slot save takes ~2.5 s locally; deploy the server in the DB's region (step 9) — never test with the real manager account

## Commands
- `.claude/launch.json` — "server" / "client" entries let Claude start both dev servers (background processes of the Claude app); a terminal `npm run dev` works too, but not both at once (ports 4000/5173)
- `cd server && npm run dev` — start API
- `cd client && npm run dev` — start frontend on http://localhost:5173 (API must be running too)
- `cd client && npm run build` / `npm run lint` — type-check + build / lint the client
- `cd server && npx prisma migrate dev --name <name>` — create + apply a migration after changing the schema
- `cd server && npx prisma db seed` — run the seed script
- `cd server && npx prisma studio` — inspect DB visually

# Shift Scheduler — Project Conventions

See `PROJECT_SPEC.md` in this repo root for the full data model (Prisma schema), the complete auth API contract, and the suggested build order. Read it before starting any feature work — this file only has the condensed conventions.

## Working style
- The developer is learning: work one small task at a time, explain each step (what, why, what the output means), and stop after each task for review.
- Git: commit after each finished, verified step. Push to GitHub only when asked. Feature work on `feature/<name>` branches.

## Stack
- Frontend: React (Vite) + TypeScript, Tailwind CSS — built mobile-first as a PWA (see "Mobile / iPhone")
- Backend: Express 5 + TypeScript (Express 5 forwards errors thrown in async handlers to the JSON error handler in `server/src/index.ts`)
- Database: PostgreSQL on Neon, via Prisma ORM (v5)
- Auth: Custom JWT (no third-party auth library), passwords hashed with bcrypt 6

## Folder structure
- `/client` — React frontend (Vite + React 19 + TS + Tailwind v4)
  - `vite.config.ts` — proxies `/api` to `http://localhost:4000` in dev, so client code calls `fetch("/api/...")` with no host/port
  - `src/main.tsx` entry → `src/App.tsx` root component; `src/index.css` just imports Tailwind
- `/server` — Express API
  - `src/prisma/schema.prisma` — data model; `src/prisma/migrations/` — generated SQL migrations (committed, never edit by hand)
  - `src/prisma/seed.ts` — creates departments, shift templates, and the only restaurant manager (details from `.env`)
  - `src/lib/` — shared helpers (`prisma.ts` client, `auth.ts` JWT/bcrypt/password rule)
  - `src/middleware/auth.ts` — `authenticate`, `requireRestaurantManager`, `requireDepartmentManager`
  - `src/routes/` — one router per resource

## Environment (`server/.env`, gitignored — template in `server/.env.example`)
- `DATABASE_URL` — Neon **pooled** connection string (host contains `-pooler`), used by the running app
- `DIRECT_URL` — same string without `-pooler`, used by `prisma migrate` (migrations need a direct connection)
- `JWT_SECRET` — long random string; `PORT` — defaults to 4000
- `SEED_MANAGER_NAME` / `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` — read only by the seed script to create the restaurant manager (temporary password, forced change on first login). Personal data and passwords never go in committed code.
- User IDs are auto-generated cuids — never use national ID numbers or other real-world identifiers as IDs.

## Domain rules (important — enforce these in middleware, not scattered checks)
- Roles: Restaurant Manager (global), Department Manager (scoped to one department), Worker
- Only the Restaurant Manager can create workers and assign their departments
- A user can be manager of at most one department (validated in `server/src/routes/users.ts`)
- A Department Manager can only create/edit/delete ShiftSlots and Shifts for their own department
- Workers can view any department's schedule, but only once that department's DepartmentSchedule.status = POSTED
- Availability is submitted per (date, shiftLabel), independent of Shift rows
- Emails are stored and compared lowercase

## Conventions
- All API routes under `/api`, RESTful, prefixed by resource (`/api/shifts`, `/api/availability`)
- Validate request bodies with zod before hitting the DB
- Auth middleware attaches `req.user` with `{ id, isRestaurantManager, departments: [{departmentId, isManager}] }`
- Schema changes: edit `schema.prisma`, then `npx prisma migrate dev --name <what_changed>`, and commit the new migration folder together with the schema change
- Commit messages: short imperative present tense ("Add shift slot endpoint", not "Added")

## Mobile / iPhone
- Target: installable PWA ("Add to Home Screen" in Safari). Design every screen mobile-first.
- Later/optional: wrap the same React app with Capacitor for the App Store.

## Progress
- [x] Server scaffolding, auth + user routes (code)
- [x] Neon database connected; initial migration `init` applied (all tables created)
- [x] Seeded: 3 departments (Waiters, Hostesses, Bar), MORNING/EVENING templates, restaurant manager account (seed is idempotent — safe to re-run)
- [x] Smoke-tested the API: `/api/health`, login (success + 401/400 failures), `/me` with/without token. Note: opening `localhost:4000` itself shows "Cannot GET /" — expected, there is no route at `/`.
- [x] Client scaffolding: `/client` created, Tailwind + `/api` proxy working (test page shows "Server connected")
- [ ] Login screen + forced password-change screen (branch `feature/login`)

## Commands
- `cd server && npm run dev` — start API
- `cd client && npm run dev` — start frontend on http://localhost:5173 (API must be running too)
- `cd client && npm run build` / `npm run lint` — type-check + build / lint the client
- `cd server && npx prisma migrate dev --name <name>` — create + apply a migration after changing the schema
- `cd server && npx prisma db seed` — run the seed script
- `cd server && npx prisma studio` — inspect DB visually

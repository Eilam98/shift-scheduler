# Shift Scheduler — Project Conventions

## Stack
- Frontend: React (Vite) + TypeScript, Tailwind CSS
- Backend: Express + TypeScript
- Database: PostgreSQL via Prisma ORM
- Auth: Custom JWT (no third-party auth library)

## Folder structure
- `/client` — React frontend
- `/server` — Express API, Prisma schema in `/server/src/prisma`

## Domain rules (important — enforce these in middleware, not scattered checks)
- Roles: Restaurant Manager (global), Department Manager (scoped to one department), Worker
- Only the Restaurant Manager can create workers and assign their departments
- A Department Manager can only create/edit/delete ShiftSlots and Shifts for their own department
- Workers can view any department's schedule, but only once that department's DepartmentSchedule.status = POSTED
- Availability is submitted per (date, shiftLabel), independent of Shift rows

## Conventions
- All API routes under `/api`, RESTful, prefixed by resource (`/api/shifts`, `/api/availability`)
- Validate request bodies with [zod or similar] before hitting the DB
- Auth middleware attaches `req.user` with `{ id, isRestaurantManager, departments: [{departmentId, isManager}] }`
- Commit messages: short imperative present tense ("Add shift slot endpoint", not "Added")

## Commands
- `cd server && npm run dev` — start API
- `cd client && npm run dev` — start frontend
- `cd server && npx prisma migrate dev` — run migrations
- `cd server && npx prisma studio` — inspect DB visually
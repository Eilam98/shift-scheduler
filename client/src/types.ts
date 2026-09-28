export interface Department {
  id: string
  name: string
}

// Where a user works and what they manage (independent of each other):
// sent to POST /users and PATCH /users/:id/departments.
export interface DepartmentRolesInput {
  memberDepartmentIds: string[]
  managedDepartmentIds: string[]
}

export interface DepartmentRef {
  departmentId: string
  departmentName: string
}

// Mirrors toDepartmentRoles in server/src/lib/users.ts.
export interface DepartmentRoles {
  memberships: DepartmentRef[]
  managedDepartments: DepartmentRef[]
}

// Mirrors toUserListItem in server/src/routes/users.ts (GET/POST /api/users).
export interface UserListItem extends DepartmentRoles {
  id: string
  name: string
  email: string
  isRestaurantManager: boolean
  isActive: boolean
}

export type ShiftLabel = 'MORNING' | 'EVENING'
export type ScheduleStatus = 'DRAFT' | 'POSTED'

export interface Slot {
  id: string
  user: { id: string; name: string } | null
}

export interface Shift {
  id: string
  date: string // "YYYY-MM-DD"
  label: ShiftLabel
  startTime: string // "HH:mm"
  endTime: string
  slots: Slot[] // only this department's slots
}

// GET /api/schedules/:weekStart/departments/:departmentId (server/src/routes/schedules.ts)
export interface DepartmentWeek {
  schedule: { id: string; weekStartDate: string }
  departmentId: string
  departmentName: string
  status: ScheduleStatus
  postedAt: string | null
  canEdit: boolean
  shifts: Shift[]
}

// GET /api/departments/:id/members
export interface Member {
  id: string
  name: string
}

// Mirrors the `user` object returned by /api/auth/login and /api/auth/me
// (see toUserResponse in server/src/routes/auth.ts).
export interface User extends DepartmentRoles {
  id: string
  name: string
  email: string
  isRestaurantManager: boolean
  requiresPasswordChange: boolean
  language: Language | null // null = restaurant default
}

export type Language = 'HE' | 'EN'

// GET /api/shifts/mine (server/src/routes/shifts.ts)
export interface MyShift {
  slotId: string
  date: string // "YYYY-MM-DD"
  label: ShiftLabel
  startTime: string
  endTime: string
  department: Department
  weekStartDate: string
}

export type NotificationType = 'SCHEDULE_POSTED' | 'SHIFT_ADDED' | 'SHIFT_REMOVED'

// GET /api/notifications (server/src/routes/notifications.ts)
export interface AppNotification {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string // ISO timestamp
  department: Department
  weekStartDate: string
  shift: { date: string; label: ShiftLabel; startTime: string; endTime: string } | null
}

export type AvailabilityStatus = 'AVAILABLE' | 'PREFER_NOT' | 'UNAVAILABLE'

export interface AvailabilityEntry {
  date: string
  label: ShiftLabel
  status: AvailabilityStatus
  note: string | null
}

// Deadline info shared by the availability responses (server/src/routes/availability.ts)
export interface AvailabilityWeekInfo {
  weekStartDate: string
  deadline: string // ISO instant of the deadline minute
  timeZone: string
  locked: boolean
}

// One person's week; updatedBy = the manager who last changed it (null = the worker)
export interface WeekSubmission {
  submitted: boolean
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
  entries: AvailabilityEntry[] // always 14: Sun morning … Sat evening
}

// GET /api/availability/team
export interface TeamAvailability extends AvailabilityWeekInfo {
  workers: (WeekSubmission & { id: string; name: string; departments: DepartmentRef[] })[]
}

// GET/PATCH /api/settings (server/src/routes/settings.ts)
export interface RestaurantSettings {
  availabilityDeadlineDay: number // 0=Sun … 6=Sat
  availabilityDeadlineTime: string // "HH:mm"
  defaultLanguage: Language
  timeZone: string
  shiftTemplates: { label: ShiftLabel; defaultStartTime: string; defaultEndTime: string }[]
}

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
  hasPin: boolean // has a time clock PIN
  canClockIn: boolean // works in an hourly department
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
  // Editors: this department's workers already working a shift of this week in another department
  elsewhere: { userId: string; shiftId: string; departmentId: string; departmentName: string }[]
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
  managesHourly: boolean // sees the Attendance page
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

// Time clock (server/src/routes/station.ts, stations.ts)
export interface StationDevice {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface PunchResult {
  action: 'IN' | 'OUT'
  name: string
  at: string // ISO, server clock
  clockIn?: string // OUT: when this entry started
  department: Department | null
  scheduled?: boolean // IN: matched a slot
}

// GET /api/attendance (server/src/routes/attendance.ts)
export interface AttendanceEntry {
  id: string
  user: { id: string; name: string }
  department: Department | null
  shift: { date: string; label: ShiftLabel; startTime: string; endTime: string } | null
  clockIn: string
  clockOut: string | null
  source: 'STATION' | 'MANUAL'
  station: string | null
  flagged: boolean
  reviewedAt: string | null
  reviewedBy: string | null
  enteredBy: string | null
  note: string | null
  missingClockOut: boolean
}

export interface AttendanceWeek {
  weekStartDate: string
  timeZone: string
  departments: Department[]
  workers: { id: string; name: string; departmentIds: string[] }[]
  entries: AttendanceEntry[]
}

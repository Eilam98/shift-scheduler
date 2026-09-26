export interface Department {
  id: string
  name: string
}

// What a user is assigned to: sent to POST /users and PATCH /users/:id/departments.
export interface DepartmentAssignment {
  departmentId: string
  isManager: boolean
}

// Mirrors toUserListItem in server/src/routes/users.ts (GET/POST /api/users).
export interface UserListItem {
  id: string
  name: string
  email: string
  isRestaurantManager: boolean
  departments: (DepartmentAssignment & { departmentName: string })[]
}

// Mirrors the `user` object returned by /api/auth/login and /api/auth/me
// (see toUserResponse in server/src/routes/auth.ts).
export interface User {
  id: string
  name: string
  email: string
  isRestaurantManager: boolean
  requiresPasswordChange: boolean
  departments: {
    departmentId: string
    departmentName: string
    isManager: boolean
  }[]
}

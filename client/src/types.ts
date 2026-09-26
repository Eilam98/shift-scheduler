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

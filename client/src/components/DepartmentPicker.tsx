import type { Department, DepartmentAssignment } from '../types'

/**
 * Choose which departments a user belongs to and which one (at most) they
 * manage. Making someone manager of a department also makes them a member,
 * and clears their manager role elsewhere — mirroring the server rule in
 * validateDepartmentAssignments (server/src/routes/users.ts).
 */
export function DepartmentPicker({
  departments,
  value,
  onChange,
}: {
  departments: Department[]
  value: DepartmentAssignment[]
  onChange: (value: DepartmentAssignment[]) => void
}) {
  function toggleMember(departmentId: string, member: boolean) {
    onChange(
      member
        ? [...value, { departmentId, isManager: false }]
        : value.filter((a) => a.departmentId !== departmentId)
    )
  }

  function toggleManager(departmentId: string, manager: boolean) {
    onChange(
      value.map((a) => ({
        ...a,
        isManager: a.departmentId === departmentId ? manager : manager ? false : a.isManager,
      }))
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Departments</legend>
      {departments.map((dept) => {
        const assignment = value.find((a) => a.departmentId === dept.id)
        return (
          <div
            key={dept.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5"
          >
            <label className="flex items-center gap-3 text-base text-slate-900">
              <input
                type="checkbox"
                className="size-5 accent-indigo-600"
                checked={!!assignment}
                onChange={(e) => toggleMember(dept.id, e.target.checked)}
              />
              {dept.name}
            </label>
            {assignment && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="size-4 accent-indigo-600"
                  checked={assignment.isManager}
                  onChange={(e) => toggleManager(dept.id, e.target.checked)}
                />
                Manager
              </label>
            )}
          </div>
        )
      })}
      <p className="text-xs text-slate-500">A person can manage at most one department.</p>
    </fieldset>
  )
}

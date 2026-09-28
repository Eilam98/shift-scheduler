import type { Department, DepartmentRolesInput } from '../types'

/**
 * Choose which departments a user works in, and separately which one (at
 * most) they manage. The two are independent: a manager doesn't have to work
 * in the department they manage (PROJECT_SPEC.md "Roles").
 */
export function DepartmentPicker({
  departments,
  value,
  onChange,
}: {
  departments: Department[]
  value: DepartmentRolesInput
  onChange: (value: DepartmentRolesInput) => void
}) {
  function toggleMember(departmentId: string, member: boolean) {
    onChange({
      ...value,
      memberDepartmentIds: member
        ? [...value.memberDepartmentIds, departmentId]
        : value.memberDepartmentIds.filter((id) => id !== departmentId),
    })
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Works in</legend>
        {departments.map((dept) => (
          <label
            key={dept.id}
            className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900"
          >
            <input
              type="checkbox"
              className="size-5 accent-indigo-600"
              checked={value.memberDepartmentIds.includes(dept.id)}
              onChange={(e) => toggleMember(dept.id, e.target.checked)}
            />
            {dept.name}
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Manages</span>
        <select
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
          value={value.managedDepartmentId ?? ''}
          onChange={(e) => onChange({ ...value, managedDepartmentId: e.target.value || null })}
        >
          <option value="">No department</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          A person can manage at most one department, whether or not they work in it.
        </span>
      </label>
    </div>
  )
}

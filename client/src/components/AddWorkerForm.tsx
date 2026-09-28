import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { PASSWORD_HINT, PASSWORD_RULE, generateTemporaryPassword } from '../lib/password'
import type { Department, DepartmentRolesInput, UserListItem } from '../types'
import { DepartmentPicker } from './DepartmentPicker'
import { Button, ErrorMessage, TextField } from './ui'

export function AddWorkerForm({
  departments,
  onCreated,
  onCancel,
}: {
  departments: Department[]
  onCreated: (user: UserListItem, temporaryPassword: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState(generateTemporaryPassword)
  const [roles, setRoles] = useState<DepartmentRolesInput>({
    memberDepartmentIds: [],
    managedDepartmentId: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!PASSWORD_RULE.test(temporaryPassword)) return setError(PASSWORD_HINT)

    setSubmitting(true)
    try {
      const user = await api<UserListItem>('/users', {
        method: 'POST',
        body: { name, email, temporaryPassword, ...roles },
      })
      onCreated(user, temporaryPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create worker')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Add worker</h2>
      <TextField
        label="Full name"
        autoComplete="off"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="off"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="Temporary password"
            autoComplete="off"
            required
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-auto! py-2.5!"
          onClick={() => setTemporaryPassword(generateTemporaryPassword())}
        >
          New
        </Button>
      </div>
      <DepartmentPicker departments={departments} value={roles} onChange={setRoles} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add worker'}
        </Button>
      </div>
    </form>
  )
}

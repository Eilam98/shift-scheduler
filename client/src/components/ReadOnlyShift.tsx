import { useI18n } from '../i18n/i18nContext'
import type { Shift } from '../types'

/** One shift in the team schedule: label, times and who works it (you highlighted). */
export function ReadOnlyShift({ shift, currentUserId }: { shift: Shift; currentUserId: string }) {
  const { t } = useI18n()

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-slate-900">{t(`shift.${shift.label}`)}</p>
        <p className="text-xs text-slate-500" dir="ltr">
          {shift.startTime}–{shift.endTime}
        </p>
      </div>
      {shift.slots.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">{t('shift.nobody')}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {shift.slots.map((slot) => {
            const isMe = slot.user?.id === currentUserId
            return (
              <li
                key={slot.id}
                className={`truncate rounded-md px-2 py-1 text-sm ${
                  isMe
                    ? 'bg-indigo-100 font-semibold text-indigo-800'
                    : slot.user
                      ? 'bg-slate-50 text-slate-800'
                      : 'text-slate-400'
                }`}
              >
                {slot.user?.name ?? t('shift.open')}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

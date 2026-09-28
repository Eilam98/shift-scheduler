import { MyShiftRow } from '../components/MyShiftRow'
import { Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { useMyShifts } from '../lib/useMyShifts'

/** /my-shifts — my upcoming shifts and the past 30 days (posted weeks only). */
export function MyShiftsPage() {
  const { t } = useI18n()
  const state = useMyShifts()

  return (
    <Screen title={t('myShifts.title')}>
      {state.status === 'loading' && <p className="text-slate-500">{t('common.loading')}</p>}
      {state.status === 'error' && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.status === 'ready' && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold text-slate-900">{t('myShifts.upcoming')}</h2>
            {state.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">{t('myShifts.noUpcoming')}</p>
            ) : (
              <div className="space-y-2">
                {state.upcoming.map((shift) => (
                  <MyShiftRow key={shift.slotId} shift={shift} />
                ))}
              </div>
            )}
          </Card>
          {state.past.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">{t('myShifts.past')}</h2>
              <div className="space-y-2">
                {state.past.map((shift) => (
                  <MyShiftRow key={shift.slotId} shift={shift} muted />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Screen>
  )
}

import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18nContext'
import type { MyShift } from '../types'
import { api } from './api'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; upcoming: MyShift[]; past: MyShift[] }

/**
 * My shifts in posted weeks (GET /api/shifts/mine), split into upcoming
 * (today onward) and past (newest first), using the server's `today` in the
 * restaurant time zone.
 */
export function useMyShifts(): State {
  const { errorMessage } = useI18n()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    api<{ today: string; shifts: MyShift[] }>('/shifts/mine')
      .then(({ today, shifts }) => {
        if (cancelled) return
        setState({
          status: 'ready',
          upcoming: shifts.filter((s) => s.date >= today),
          past: shifts.filter((s) => s.date < today).reverse(),
        })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [errorMessage])

  return state
}

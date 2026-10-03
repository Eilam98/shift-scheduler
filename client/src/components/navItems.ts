import type { ComponentType, SVGProps } from 'react'
import type { MessageKey } from '../i18n/messages'
import type { User } from '../types'
import {
  CalendarIcon,
  GameIcon,
  ClockIcon,
  GearIcon,
  HomeIcon,
  ListCheckIcon,
  ReceiptIcon,
  StopwatchIcon,
  UserIcon,
  UsersIcon,
} from './icons'

export interface NavItem {
  to: string
  label: MessageKey
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean // "/" must only be active on exactly "/"
}

/** Phone bottom bar size: with more items, the last tab becomes "More". */
export const PHONE_TABS = 5

/** The screens this user can reach — drives the side menu, the tab bar and /more. */
export function navItems(user: User): NavItem[] {
  const worksShifts = user.memberships.length > 0
  const isManager = user.isRestaurantManager || user.managedDepartments.length > 0
  const items: (NavItem | false)[] = [
    { to: '/', label: 'nav.home', icon: HomeIcon, end: true },
    { to: '/schedule', label: 'nav.schedule', icon: CalendarIcon },
    worksShifts && { to: '/my-shifts', label: 'nav.myShifts', icon: ClockIcon },
    (worksShifts || isManager) && { to: '/availability', label: 'nav.availability', icon: ListCheckIcon },
    user.fillsReports && { to: '/shift-report', label: 'nav.shiftReport', icon: ReceiptIcon },
    user.managesHourly && { to: '/attendance', label: 'nav.attendance', icon: StopwatchIcon },
    user.isRestaurantManager && { to: '/workers', label: 'nav.workers', icon: UsersIcon },
    user.isRestaurantManager && { to: '/settings', label: 'nav.settings', icon: GearIcon },
    { to: '/tetris', label: 'nav.tetris', icon: GameIcon },
    { to: '/profile', label: 'nav.profile', icon: UserIcon },
  ]
  return items.filter((item): item is NavItem => item !== false)
}

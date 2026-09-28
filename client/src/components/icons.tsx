import type { SVGProps } from 'react'

// Inline outline icons (24×24, stroke = currentColor) so they follow text colour.

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  )
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Icon>
  )
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  )
}

/** Points toward the end of the line: right in LTR, left in RTL. */
export function ChevronEndIcon({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Icon className={`rtl:rotate-180 ${className}`} {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

/** Points toward the start of the line: left in LTR, right in RTL. */
export function ChevronStartIcon({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Icon className={`rtl:rotate-180 ${className}`} {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  )
}

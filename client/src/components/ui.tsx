import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { LanguageBar } from './LanguageToggle'

// Small shared building blocks so every screen looks consistent. Mobile-first;
// direction-neutral classes (ms/me/ps/pe, start/end) so RTL works.

/**
 * Page content inside the app shell: a title row and a centred column.
 * `wide` lets desktop layouts (e.g. the week grid) use the full width.
 */
export function Screen({
  title,
  actions,
  wide = false,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={`mx-auto px-4 py-6 md:px-8 md:py-10 ${wide ? 'max-w-screen-2xl' : 'max-w-3xl'}`}>
      {title && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

/** Full-page narrow column without navigation (login, forced password change). */
export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50">
      <LanguageBar />
      <div className="mx-auto max-w-md px-4 py-10">{children}</div>
    </main>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-sm ${className}`}>{children}</div>
}

export function TextField({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...inputProps}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: { variant?: keyof typeof BUTTON_VARIANTS } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg px-4 py-3 text-base font-semibold disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  )
}

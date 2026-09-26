import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

// Small shared building blocks so every screen looks consistent on mobile.

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">{children}</div>
    </main>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
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

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 ${className}`}
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

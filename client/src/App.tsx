import { useEffect, useState } from 'react'

type ServerStatus = 'checking' | 'connected' | 'unreachable'

// Temporary page for the client-setup step: proves the client can reach
// the API through Vite's /api proxy. Replaced by the login flow next.
function App() {
  const [status, setStatus] = useState<ServerStatus>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setStatus(res.ok ? 'connected' : 'unreachable'))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Shift Organizer</h1>
        <p className="mt-1 text-slate-500">Client setup check</p>

        <div className="mt-6 rounded-xl border border-slate-200 p-4 text-lg">
          {status === 'checking' && <p className="text-slate-500">Checking server…</p>}
          {status === 'connected' && <p className="text-green-700">✅ Server connected</p>}
          {status === 'unreachable' && (
            <p className="text-red-700">
              ❌ Can't reach the server — is <code>npm run dev</code> running in <code>/server</code>?
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default App

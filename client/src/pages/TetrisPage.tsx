import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { Button, Card, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { COLORS, COLS, ROWS, Tetris, gravityMs, shapeOf, type PieceType } from '../lib/tetris'

const CELL = 30 // drawing units per cell; CSS scales the canvas to fit the screen

interface Hud {
  score: number
  lines: number
  level: number
  next: PieceType[]
  hold: PieceType | null
}
const EMPTY_HUD: Hud = { score: 0, lines: 0, level: 1, next: [], hold: null }

type Status = 'ready' | 'playing' | 'paused' | 'over'

interface Best {
  score: number
  lines: number
  level: number
  gamesPlayed: number
  achievedAt: string
}
interface Leaderboard {
  entries: (Best & { rank: number; userId: string; name: string })[]
  me: (Best & { rank: number }) | null
}
interface GameResult {
  newBest: boolean
  best: Best
  rank: number
}

/** /tetris — a game for everyone; best scores are kept and shown on a leaderboard. */
export function TetrisPage() {
  const { t, errorMessage } = useI18n()
  const { user } = useAuth()
  const game = useRef<Tetris | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<Status>('ready')
  // A snapshot of what the side panel shows, copied from the engine after each move
  // (the engine lives in a ref, which React doesn't watch).
  const [hud, setHud] = useState<Hud>(EMPTY_HUD)
  const [result, setResult] = useState<GameResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [boardReloads, setBoardReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<Leaderboard>('/tetris/leaderboard')
      .then((data) => {
        if (!cancelled) setBoard(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [boardReloads])

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext('2d')
    const g = game.current
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL)
    // faint grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    for (let x = 1; x < COLS; x++) ctx.strokeRect(x * CELL, 0, 0, ROWS * CELL)
    for (let y = 1; y < ROWS; y++) ctx.strokeRect(0, y * CELL, COLS * CELL, 0)
    if (!g) return

    const cell = (x: number, y: number, color: string, alpha = 1) => {
      if (y < 0) return
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
      ctx.globalAlpha = 1
    }
    g.board.forEach((row, y) => row.forEach((type, x) => type && cell(x, y, COLORS[type])))
    if (!g.over) {
      const { matrix, x, y, type } = g.piece
      const ghost = g.ghostY()
      matrix.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!v) return
          cell(x + c, ghost + r, COLORS[type], 0.2)
          cell(x + c, y + r, COLORS[type])
        })
      )
    }
  }, [])

  const refresh = useCallback(() => {
    draw()
    const g = game.current
    if (g) setHud({ score: g.score, lines: g.lines, level: g.level, next: g.next, hold: g.hold })
  }, [draw])

  const finish = useCallback(async () => {
    const g = game.current
    if (!g) return
    setStatus('over')
    setSaving(true)
    setSaveError(null)
    try {
      setResult(
        await api<GameResult>('/tetris/games', {
          method: 'POST',
          body: { score: g.score, lines: g.lines, level: g.level },
        })
      )
      setBoardReloads((n) => n + 1)
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [errorMessage])

  /** Run one player action (or gravity), redraw, and end the game if it's over. */
  const act = useCallback(
    (action: (g: Tetris) => void) => {
      const g = game.current
      if (!g || g.over) return
      action(g)
      refresh()
      if (g.over) void finish()
    },
    [refresh, finish]
  )

  function start() {
    game.current = new Tetris()
    setResult(null)
    setSaveError(null)
    setStatus('playing')
    refresh()
  }

  // Gravity: one row every gravityMs(level), restarted when the level changes.
  const level = hud.level
  useEffect(() => {
    if (status !== 'playing') return
    const timer = setInterval(() => act((g) => g.tick()), gravityMs(level))
    return () => clearInterval(timer)
  }, [status, level, act])

  // Keyboard (desktop).
  useEffect(() => {
    if (status !== 'playing' && status !== 'paused') return
    function onKey(e: KeyboardEvent) {
      const keys: Record<string, () => void> = {
        ArrowLeft: () => act((g) => g.move(-1)),
        ArrowRight: () => act((g) => g.move(1)),
        ArrowDown: () => act((g) => g.softDrop()),
        ArrowUp: () => act((g) => g.rotate(true)),
        x: () => act((g) => g.rotate(true)),
        z: () => act((g) => g.rotate(false)),
        ' ': () => act((g) => g.hardDrop()),
        c: () => act((g) => g.holdPiece()),
        Shift: () => act((g) => g.holdPiece()),
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === 'p' || key === 'Escape') {
        e.preventDefault()
        setStatus((s) => (s === 'playing' ? 'paused' : 'playing'))
        return
      }
      if (status !== 'playing' || !keys[key]) return
      e.preventDefault() // don't scroll the page with arrows / space
      keys[key]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, act])

  // Pause when the tab is hidden.
  useEffect(() => {
    const onHide = () => document.hidden && setStatus((s) => (s === 'playing' ? 'paused' : s))
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => draw(), [draw])

  return (
    <Screen wide title={t('tetris.title')}>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
        {/* The game area stays left-to-right in both languages (left/right controls). */}
        <div dir="ltr" className="flex flex-col items-center gap-3">
          <div className="flex items-start gap-3">
            <div className="relative">
              <canvas
                ref={canvas}
                width={COLS * CELL}
                height={ROWS * CELL}
                className="block h-auto w-[min(62vw,300px)] rounded-lg shadow-md"
                aria-label={t('tetris.title')}
              />
              {status !== 'playing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-900/75 p-4 text-center text-white">
                  {status === 'paused' && <p className="text-xl font-semibold">{t('tetris.paused')}</p>}
                  {status === 'over' && (
                    <>
                      <p className="text-xl font-semibold">{t('tetris.gameOver')}</p>
                      <p className="text-3xl font-bold tabular-nums">{hud.score.toLocaleString()}</p>
                      {saving && <p className="text-sm text-slate-300">{t('tetris.saving')}</p>}
                      {result?.newBest && <p className="font-semibold text-yellow-300">{t('tetris.newBest')}</p>}
                      {result && <p className="text-sm text-slate-200">{t('tetris.rank', { rank: result.rank })}</p>}
                      {saveError && <p className="text-sm text-red-300">{saveError}</p>}
                    </>
                  )}
                  <Button className="w-auto! px-6" onClick={status === 'paused' ? () => setStatus('playing') : start}>
                    {status === 'paused' ? t('tetris.resume') : status === 'over' ? t('tetris.playAgain') : t('tetris.start')}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex w-20 flex-col gap-3 sm:w-24">
              <Panel title={t('tetris.score')}>
                <p className="text-lg font-bold tabular-nums">{hud.score.toLocaleString()}</p>
              </Panel>
              <Panel title={t('tetris.lines')}>
                <p className="font-semibold tabular-nums">{hud.lines}</p>
              </Panel>
              <Panel title={t('tetris.level')}>
                <p className="font-semibold tabular-nums">{hud.level}</p>
              </Panel>
              <Panel title={t('tetris.next')}>
                <div className="space-y-2">
                  {hud.next.map((type, i) => (
                    <MiniPiece key={i} type={type} />
                  ))}
                </div>
              </Panel>
              <Panel title={t('tetris.hold')}>{hud.hold ? <MiniPiece type={hud.hold} /> : <div className="h-6" />}</Panel>
              {status === 'playing' && (
                <button onClick={() => setStatus('paused')} className="rounded-lg bg-white px-2 py-1.5 text-sm shadow-sm">
                  {t('tetris.pause')}
                </button>
              )}
            </div>
          </div>

          {/* Touch controls (shown on any screen; handy on phones) */}
          <div className="grid w-full max-w-sm grid-cols-4 gap-2 select-none">
            <ControlButton label="⟲" aria={t('tetris.rotateBack')} onPress={() => act((g) => g.rotate(false))} disabled={status !== 'playing'} />
            <ControlButton label="⟳" aria={t('tetris.rotate')} onPress={() => act((g) => g.rotate(true))} disabled={status !== 'playing'} />
            <ControlButton label={t('tetris.holdShort')} aria={t('tetris.hold')} onPress={() => act((g) => g.holdPiece())} disabled={status !== 'playing'} />
            <ControlButton label="⤓" aria={t('tetris.hardDrop')} onPress={() => act((g) => g.hardDrop())} disabled={status !== 'playing'} />
            <ControlButton label="←" aria={t('tetris.left')} onPress={() => act((g) => g.move(-1))} repeat disabled={status !== 'playing'} />
            <ControlButton label="↓" aria={t('tetris.softDrop')} onPress={() => act((g) => g.softDrop())} repeat disabled={status !== 'playing'} className="col-span-2" />
            <ControlButton label="→" aria={t('tetris.right')} onPress={() => act((g) => g.move(1))} repeat disabled={status !== 'playing'} />
          </div>
          <p className="hidden max-w-sm text-center text-xs text-slate-500 md:block">{t('tetris.keysHelp')}</p>
        </div>

        <LeaderboardCard board={board} currentUserId={user?.id ?? ''} />
      </div>
    </Screen>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-2 text-center shadow-sm">
      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <div className="mt-1 flex justify-center">{children}</div>
    </div>
  )
}

/** A small preview of a piece (next / hold). */
function MiniPiece({ type }: { type: PieceType }) {
  const shape = shapeOf(type).filter((row) => row.some(Boolean))
  return (
    <div className="flex flex-col items-center gap-0.5">
      {shape.map((row, r) => (
        <div key={r} className="flex gap-0.5">
          {row.map((v, c) => (
            <span key={c} className="size-2.5 rounded-[2px] sm:size-3" style={{ backgroundColor: v ? COLORS[type] : 'transparent' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** On-screen control; `repeat` keeps acting while held (moving / soft drop). */
function ControlButton({
  label,
  aria,
  onPress,
  repeat = false,
  disabled,
  className = '',
}: {
  label: string
  aria: string
  onPress: () => void
  repeat?: boolean
  disabled: boolean
  className?: string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  return (
    <button
      aria-label={aria}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
        if (!repeat) return
        const loop = (delay: number) => {
          timer.current = setTimeout(() => {
            onPress()
            loop(60)
          }, delay)
        }
        loop(220) // a short pause, then repeat quickly
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`h-14 touch-none rounded-xl bg-slate-800 text-2xl font-semibold text-white active:bg-slate-600 disabled:opacity-40 ${className}`}
    >
      {label}
    </button>
  )
}

function LeaderboardCard({ board, currentUserId }: { board: Leaderboard | null; currentUserId: string }) {
  const { t } = useI18n()
  return (
    <Card className="lg:max-w-md">
      <h2 className="font-semibold text-slate-900">{t('tetris.leaderboard')}</h2>
      {board?.me && (
        <p className="mt-1 text-sm text-slate-600">
          {t('tetris.yourBest', { score: board.me.score.toLocaleString(), rank: board.me.rank })} ·{' '}
          {board.me.gamesPlayed === 1 ? t('tetris.gamesOne') : t('tetris.games', { count: board.me.gamesPlayed })}
        </p>
      )}
      {!board ? (
        <p className="mt-3 text-sm text-slate-500">{t('common.loading')}</p>
      ) : board.entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('tetris.noScores')}</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {board.entries.map((e) => {
            const me = e.userId === currentUserId
            return (
              <li
                key={e.userId}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${me ? 'bg-indigo-50 font-semibold text-indigo-900' : 'text-slate-800'}`}
              >
                <span className="w-6 text-center font-bold text-slate-500">
                  {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}
                </span>
                <span className="flex-1 truncate">{e.name}</span>
                <span className="text-xs text-slate-500">
                  {t('tetris.linesLevel', { lines: e.lines, level: e.level })}
                </span>
                <span className="w-20 text-end font-bold tabular-nums" dir="ltr">
                  {e.score.toLocaleString()}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {!board?.me && board && <p className="mt-3 text-xs text-slate-500">{t('tetris.playToJoin')}</p>}
    </Card>
  )
}


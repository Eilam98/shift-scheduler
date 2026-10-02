// A small Tetris engine, separate from React: the page keeps one Tetris
// object in a ref, calls its moves, and redraws. Guideline-style rules:
// 7-bag randomizer, hold, ghost, levels every 10 lines, 100/300/500/800 × level
// for 1–4 lines, +1 per soft-drop cell, +2 per hard-drop cell.

export const COLS = 10
export const ROWS = 20

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
type Matrix = number[][]
export type Board = (PieceType | null)[][]

const SHAPES: Record<PieceType, Matrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

export const COLORS: Record<PieceType, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#a855f7',
  S: '#22c55e',
  Z: '#ef4444',
  J: '#3b82f6',
  L: '#f97316',
}

export const shapeOf = (type: PieceType): Matrix => SHAPES[type]

const LINE_POINTS = [0, 100, 300, 500, 800]
/** If a rotation collides, try these nudges (x, y) — a simple wall kick. */
const KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
]

function rotateMatrix(m: Matrix, clockwise: boolean): Matrix {
  const n = m.length
  return m.map((row, r) => row.map((_, c) => (clockwise ? m[n - 1 - c][r] : m[c][n - 1 - r])))
}

function newBag(): PieceType[] {
  const bag: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

/** Milliseconds per row of gravity at a level (guideline curve, floored). */
export function gravityMs(level: number): number {
  return Math.max(30, Math.round(1000 * Math.pow(0.8 - (level - 1) * 0.007, level - 1)))
}

export interface Piece {
  type: PieceType
  matrix: Matrix
  x: number
  y: number
}

export class Tetris {
  board: Board = Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null))
  queue: PieceType[] = [...newBag(), ...newBag()]
  piece: Piece
  hold: PieceType | null = null
  canHold = true
  score = 0
  lines = 0
  level = 1
  over = false

  constructor() {
    this.piece = this.spawn(this.takeNext())
  }

  /** The next pieces, for the preview. */
  get next(): PieceType[] {
    return this.queue.slice(0, 3)
  }

  private takeNext(): PieceType {
    if (this.queue.length <= 7) this.queue.push(...newBag())
    return this.queue.shift()!
  }

  private spawn(type: PieceType): Piece {
    const matrix = SHAPES[type]
    const piece = { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: type === 'I' ? -1 : 0 }
    if (this.collides(piece.matrix, piece.x, piece.y)) this.over = true
    return piece
  }

  private collides(matrix: Matrix, x: number, y: number): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (!matrix[r][c]) continue
        const bx = x + c
        const by = y + r
        if (bx < 0 || bx >= COLS || by >= ROWS) return true
        if (by >= 0 && this.board[by][bx]) return true
      }
    }
    return false
  }

  move(dx: number): boolean {
    if (this.over || this.collides(this.piece.matrix, this.piece.x + dx, this.piece.y)) return false
    this.piece.x += dx
    return true
  }

  rotate(clockwise = true): boolean {
    if (this.over || this.piece.type === 'O') return false
    const matrix = rotateMatrix(this.piece.matrix, clockwise)
    for (const [dx, dy] of KICKS) {
      if (!this.collides(matrix, this.piece.x + dx, this.piece.y + dy)) {
        this.piece = { ...this.piece, matrix, x: this.piece.x + dx, y: this.piece.y + dy }
        return true
      }
    }
    return false
  }

  /** One row of gravity; locks the piece when it can't fall further. */
  tick() {
    if (this.over) return
    if (!this.collides(this.piece.matrix, this.piece.x, this.piece.y + 1)) this.piece.y++
    else this.lock()
  }

  /** Player pushing down: +1 point per row; locks if already on the floor. */
  softDrop() {
    if (this.over) return
    if (!this.collides(this.piece.matrix, this.piece.x, this.piece.y + 1)) {
      this.piece.y++
      this.score += 1
    } else this.lock()
  }

  /** Drop straight down and lock: +2 points per row. */
  hardDrop() {
    if (this.over) return
    const target = this.ghostY()
    this.score += 2 * (target - this.piece.y)
    this.piece.y = target
    this.lock()
  }

  /** Swap the falling piece with the held one (once per piece). */
  holdPiece() {
    if (this.over || !this.canHold) return
    const current = this.piece.type
    this.piece = this.spawn(this.hold ?? this.takeNext())
    this.hold = current
    this.canHold = false
  }

  /** Where the piece would land (the ghost). */
  ghostY(): number {
    let y = this.piece.y
    while (!this.collides(this.piece.matrix, this.piece.x, y + 1)) y++
    return y
  }

  private lock() {
    const { matrix, x, y, type } = this.piece
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (!matrix[r][c]) continue
        if (y + r < 0) {
          this.over = true // locked above the top
          return
        }
        this.board[y + r][x + c] = type
      }
    }
    const kept = this.board.filter((row) => row.some((cell) => !cell))
    const cleared = ROWS - kept.length
    if (cleared > 0) {
      this.board = [...Array.from({ length: cleared }, () => Array<PieceType | null>(COLS).fill(null)), ...kept]
      this.score += LINE_POINTS[cleared] * this.level
      this.lines += cleared
      this.level = 1 + Math.floor(this.lines / 10)
    }
    this.canHold = true
    this.piece = this.spawn(this.takeNext())
  }
}

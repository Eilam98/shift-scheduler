import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

// Tetris (just for fun): everyone's best score + a leaderboard. Scores come
// from the browser at game over, so they're sanity-checked, not cheat-proof.
const router = Router();
router.use(authenticate);

const LEADERBOARD_SIZE = 50;

const gameSchema = z.object({
  score: z.number().int().min(0).max(10_000_000),
  lines: z.number().int().min(0).max(10_000),
  level: z.number().int().min(1).max(100),
});

/** Rank of a score among active players: 1 + how many have a strictly better one. */
async function rankOf(score: number): Promise<number> {
  return 1 + (await prisma.tetrisScore.count({ where: { score: { gt: score }, user: { isActive: true } } }));
}

/**
 * POST /api/tetris/games { score, lines, level } — a finished game. Counts it,
 * and keeps it as the player's best if it beats the old one.
 */
router.post("/games", async (req, res) => {
  const parsed = gameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "score, lines and level must be valid numbers" });
  const game = parsed.data;
  const userId = req.user!.id;

  const previous = await prisma.tetrisScore.findUnique({ where: { userId } });
  const newBest = !previous || game.score > previous.score;
  const best = await prisma.tetrisScore.upsert({
    where: { userId },
    create: { userId, ...game, achievedAt: new Date(), gamesPlayed: 1 },
    update: {
      gamesPlayed: { increment: 1 },
      ...(newBest && { ...game, achievedAt: new Date() }),
    },
  });

  return res.status(200).json({
    newBest,
    best: { score: best.score, lines: best.lines, level: best.level, achievedAt: best.achievedAt, gamesPlayed: best.gamesPlayed },
    rank: await rankOf(best.score),
  });
});

// GET /api/tetris/leaderboard — the top best scores (active people), plus mine.
router.get("/leaderboard", async (req, res) => {
  const [top, mine] = await Promise.all([
    prisma.tetrisScore.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { name: true } } },
      orderBy: [{ score: "desc" }, { achievedAt: "asc" }], // ties: whoever got there first
      take: LEADERBOARD_SIZE,
    }),
    prisma.tetrisScore.findUnique({ where: { userId: req.user!.id } }),
  ]);

  // Equal scores share a rank (1, 2, 2, 4…).
  let rank = 0;
  const entries = top.map((row, i) => {
    if (i === 0 || row.score !== top[i - 1].score) rank = i + 1;
    return {
      rank,
      userId: row.userId,
      name: row.user.name,
      score: row.score,
      lines: row.lines,
      level: row.level,
      gamesPlayed: row.gamesPlayed,
      achievedAt: row.achievedAt,
    };
  });

  return res.status(200).json({
    entries,
    me: mine && {
      score: mine.score,
      lines: mine.lines,
      level: mine.level,
      gamesPlayed: mine.gamesPlayed,
      achievedAt: mine.achievedAt,
      rank: await rankOf(mine.score),
    },
  });
});

export default router;

-- Tetris best scores. (Generated diff also wanted to drop Neon's sample table
-- "playing_with_neon" — removed by hand; never drop it.)
-- CreateTable
CREATE TABLE "TetrisScore" (
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "lines" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TetrisScore_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "TetrisScore_score_idx" ON "TetrisScore"("score");

-- AddForeignKey
ALTER TABLE "TetrisScore" ADD CONSTRAINT "TetrisScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


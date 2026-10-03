-- End-of-shift report: REPORT time entries + TipPool. (Generated diff also wanted
-- to drop Neon's sample table "playing_with_neon" - removed by hand; never drop it.)
-- AlterEnum
ALTER TYPE "TimeEntrySource" ADD VALUE 'REPORT';

-- CreateTable
CREATE TABLE "TipPool" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipPool_shiftId_key" ON "TipPool"("shiftId");

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


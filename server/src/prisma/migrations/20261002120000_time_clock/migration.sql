-- Time clock: TimeEntry + StationDevice, unique PINs. (The generated diff also
-- wanted to drop Neon's sample table "playing_with_neon", which isn't ours —
-- removed by hand before applying; the table is left untouched.)
-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('STATION', 'MANUAL');

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "shiftId" TEXT,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "source" "TimeEntrySource" NOT NULL,
    "stationId" TEXT,
    "enteredById" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_userId_clockIn_idx" ON "TimeEntry"("userId", "clockIn");

-- CreateIndex
CREATE INDEX "TimeEntry_departmentId_clockIn_idx" ON "TimeEntry"("departmentId", "clockIn");

-- CreateIndex
CREATE UNIQUE INDEX "StationDevice_tokenHash_key" ON "StationDevice"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_pinHash_key" ON "User"("pinHash");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "StationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationDevice" ADD CONSTRAINT "StationDevice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


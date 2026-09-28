-- Replaces the yes/no `available` column with three levels. Safe to drop:
-- the Availability table was empty when this was written (nothing used it yet).
-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'PREFER_NOT', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "Availability" DROP COLUMN "available",
ADD COLUMN     "status" "AvailabilityStatus" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


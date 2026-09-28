-- Hand-edited (before being applied): copies UserDepartment into
-- DepartmentMembership + DepartmentManager before dropping it, and runs as
-- one transaction so a failure leaves the database untouched.
BEGIN;

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('FIXED', 'TIPS');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('HE', 'EN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "language" "Language",
ADD COLUMN     "pinHash" TEXT;

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "hourlyBonus" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentManager" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "DepartmentManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentPayRate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "payType" "PayType" NOT NULL,
    "hourlyRate" INTEGER,
    "minimumHourlyRate" INTEGER,

    CONSTRAINT "DepartmentPayRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "availabilityDeadlineDay" INTEGER NOT NULL DEFAULT 3,
    "availabilityDeadlineTime" TEXT NOT NULL DEFAULT '23:59',
    "defaultLanguage" "Language" NOT NULL DEFAULT 'HE',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Jerusalem',

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_userId_departmentId_key" ON "DepartmentMembership"("userId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentManager_userId_key" ON "DepartmentManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPayRate_departmentId_effectiveFrom_key" ON "DepartmentPayRate"("departmentId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentManager" ADD CONSTRAINT "DepartmentManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentManager" ADD CONSTRAINT "DepartmentManager_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentPayRate" ADD CONSTRAINT "DepartmentPayRate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Copy data: every UserDepartment row stays a membership; isManager rows also
-- become manager rows. Reusing the old ids keeps them valid cuids.
INSERT INTO "DepartmentMembership" ("id", "userId", "departmentId")
SELECT "id", "userId", "departmentId" FROM "UserDepartment";

INSERT INTO "DepartmentManager" ("id", "userId", "departmentId")
SELECT "id", "userId", "departmentId" FROM "UserDepartment" WHERE "isManager";

-- DropForeignKey
ALTER TABLE "UserDepartment" DROP CONSTRAINT "UserDepartment_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "UserDepartment" DROP CONSTRAINT "UserDepartment_userId_fkey";

-- DropTable
DROP TABLE "UserDepartment";

COMMIT;

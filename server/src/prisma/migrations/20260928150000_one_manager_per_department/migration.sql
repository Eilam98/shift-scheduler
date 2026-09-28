-- Written by hand (no shadow database). Flips the uniqueness: a user may now
-- manage several departments, but a department has at most one manager.
-- DropIndex
DROP INDEX "DepartmentManager_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentManager_departmentId_key" ON "DepartmentManager"("departmentId");

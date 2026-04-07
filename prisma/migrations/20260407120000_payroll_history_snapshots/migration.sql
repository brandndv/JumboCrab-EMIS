-- CreateEnum
CREATE TYPE "PayrollFrequency" AS ENUM ('WEEKLY', 'BIMONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ContributionSchedule" AS ENUM ('PER_PAYROLL', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'AD_HOC');

-- AlterTable
ALTER TABLE "EmployeeContribution"
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'BIMONTHLY',
ADD COLUMN "sssSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
ADD COLUMN "philHealthSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
ADD COLUMN "pagIbigSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
ADD COLUMN "withholdingSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL';

-- AlterTable
ALTER TABLE "EmployeeRateHistory"
ADD COLUMN "hourlyRate" DECIMAL(10,2),
ADD COLUMN "monthlyRate" DECIMAL(10,2),
ADD COLUMN "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'BIMONTHLY',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "createdByUserId" TEXT;

-- CreateTable
CREATE TABLE "EmployeePositionHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePositionHistory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PayrollDeduction"
ADD COLUMN "payrollFrequency" "PayrollFrequency",
ADD COLUMN "periodStartSnapshot" TIMESTAMP(3),
ADD COLUMN "periodEndSnapshot" TIMESTAMP(3),
ADD COLUMN "quantitySnapshot" DECIMAL(12,2),
ADD COLUMN "unitLabelSnapshot" TEXT,
ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_employeeId_effectiveFrom_idx" ON "EmployeePositionHistory"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_departmentId_idx" ON "EmployeePositionHistory"("departmentId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_positionId_idx" ON "EmployeePositionHistory"("positionId");

-- AddForeignKey
ALTER TABLE "EmployeeRateHistory" ADD CONSTRAINT "EmployeeRateHistory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("departmentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("positionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

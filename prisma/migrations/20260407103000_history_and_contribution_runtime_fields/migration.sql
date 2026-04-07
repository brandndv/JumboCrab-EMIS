DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollFrequency') THEN
    CREATE TYPE "PayrollFrequency" AS ENUM ('WEEKLY', 'BIMONTHLY', 'MONTHLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContributionSchedule') THEN
    CREATE TYPE "ContributionSchedule" AS ENUM ('PER_PAYROLL', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'AD_HOC');
  END IF;
END $$;

ALTER TABLE "EmployeeContribution"
  ADD COLUMN IF NOT EXISTS "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'BIMONTHLY',
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'PHP',
  ADD COLUMN IF NOT EXISTS "sssSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
  ADD COLUMN IF NOT EXISTS "philHealthSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
  ADD COLUMN IF NOT EXISTS "pagIbigSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL',
  ADD COLUMN IF NOT EXISTS "withholdingSchedule" "ContributionSchedule" NOT NULL DEFAULT 'PER_PAYROLL';

ALTER TABLE "EmployeeRateHistory"
  ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "monthlyRate" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'BIMONTHLY',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'EmployeeRateHistory_createdByUserId_fkey'
      AND table_name = 'EmployeeRateHistory'
  ) THEN
    ALTER TABLE "EmployeeRateHistory"
      ADD CONSTRAINT "EmployeeRateHistory_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeeRateHistory_createdByUserId_idx"
  ON "EmployeeRateHistory"("createdByUserId");

CREATE TABLE IF NOT EXISTS "EmployeePositionHistory" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePositionHistory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EmployeePositionHistory_employeeId_fkey'
      AND table_name = 'EmployeePositionHistory'
  ) THEN
    ALTER TABLE "EmployeePositionHistory"
      ADD CONSTRAINT "EmployeePositionHistory_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EmployeePositionHistory_departmentId_fkey'
      AND table_name = 'EmployeePositionHistory'
  ) THEN
    ALTER TABLE "EmployeePositionHistory"
      ADD CONSTRAINT "EmployeePositionHistory_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("departmentId")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EmployeePositionHistory_positionId_fkey'
      AND table_name = 'EmployeePositionHistory'
  ) THEN
    ALTER TABLE "EmployeePositionHistory"
      ADD CONSTRAINT "EmployeePositionHistory_positionId_fkey"
      FOREIGN KEY ("positionId") REFERENCES "Position"("positionId")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EmployeePositionHistory_createdByUserId_fkey'
      AND table_name = 'EmployeePositionHistory'
  ) THEN
    ALTER TABLE "EmployeePositionHistory"
      ADD CONSTRAINT "EmployeePositionHistory_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmployeePositionHistory_employeeId_effectiveFrom_idx"
  ON "EmployeePositionHistory"("employeeId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "EmployeePositionHistory_departmentId_idx"
  ON "EmployeePositionHistory"("departmentId");
CREATE INDEX IF NOT EXISTS "EmployeePositionHistory_positionId_idx"
  ON "EmployeePositionHistory"("positionId");

ALTER TABLE "PayrollDeduction"
  ADD COLUMN IF NOT EXISTS "payrollFrequency" "PayrollFrequency",
  ADD COLUMN IF NOT EXISTS "periodStartSnapshot" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodEndSnapshot" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "quantitySnapshot" DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS "unitLabelSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

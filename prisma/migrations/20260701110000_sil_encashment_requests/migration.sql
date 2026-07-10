ALTER TYPE "LeaveCreditLedgerEntryType" ADD VALUE IF NOT EXISTS 'ENCASHMENT';

CREATE TABLE IF NOT EXISTS "SilEncashmentRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
  "employeeRemarks" TEXT,
  "managerRemarks" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "ledgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SilEncashmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SilEncashmentRequest_employeeId_status_submittedAt_idx"
  ON "SilEncashmentRequest"("employeeId", "status", "submittedAt");

CREATE INDEX IF NOT EXISTS "SilEncashmentRequest_status_submittedAt_idx"
  ON "SilEncashmentRequest"("status", "submittedAt");

CREATE INDEX IF NOT EXISTS "SilEncashmentRequest_reviewedByUserId_reviewedAt_idx"
  ON "SilEncashmentRequest"("reviewedByUserId", "reviewedAt");

CREATE INDEX IF NOT EXISTS "SilEncashmentRequest_ledgerEntryId_idx"
  ON "SilEncashmentRequest"("ledgerEntryId");

ALTER TABLE "SilEncashmentRequest"
  ADD CONSTRAINT "SilEncashmentRequest_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SilEncashmentRequest"
  ADD CONSTRAINT "SilEncashmentRequest_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("userId")
  ON DELETE SET NULL ON UPDATE CASCADE;

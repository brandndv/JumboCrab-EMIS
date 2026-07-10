CREATE TYPE "GovernmentLoanAgency" AS ENUM ('SSS_SALARY_LOAN', 'PAGIBIG_MPL');

CREATE TYPE "GovernmentLoanAssistanceRequestStatus" AS ENUM ('PENDING_MANAGER_REVIEW', 'PROCESSING', 'APPROVED_BY_AGENCY', 'DECLINED_BY_AGENCY', 'RECORDED_IN_PAYROLL', 'CANCELLED');

ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'GOVERNMENT_LOAN_REQUEST_SUBMITTED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'GOVERNMENT_LOAN_REQUEST_PROCESSING';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'GOVERNMENT_LOAN_REQUEST_APPROVED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'GOVERNMENT_LOAN_REQUEST_DECLINED';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'GOVERNMENT_LOAN_REQUEST_RECORDED';

CREATE TABLE "GovernmentLoanAssistanceRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "agency" "GovernmentLoanAgency" NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "estimatedMonthlyDeduction" DECIMAL(12,2) NOT NULL,
    "estimatedPerPayrollDeduction" DECIMAL(12,2) NOT NULL,
    "governmentIdSnapshot" TEXT NOT NULL,
    "monthlySalarySnapshot" DECIMAL(12,2),
    "checklist" JSONB,
    "status" "GovernmentLoanAssistanceRequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER_REVIEW',
    "employeeRemarks" TEXT,
    "managerRemarks" TEXT,
    "agencyRemarks" TEXT,
    "approvedAmount" DECIMAL(12,2),
    "approvedMonthlyPayment" DECIMAL(12,2),
    "repaymentStartDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "deductionAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentLoanAssistanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernmentLoanAssistanceRequest_deductionAssignmentId_key" ON "GovernmentLoanAssistanceRequest"("deductionAssignmentId");
CREATE INDEX "GovernmentLoanAssistanceRequest_employeeId_status_submittedAt_idx" ON "GovernmentLoanAssistanceRequest"("employeeId", "status", "submittedAt");
CREATE INDEX "GovernmentLoanAssistanceRequest_status_submittedAt_idx" ON "GovernmentLoanAssistanceRequest"("status", "submittedAt");
CREATE INDEX "GovernmentLoanAssistanceRequest_agency_status_idx" ON "GovernmentLoanAssistanceRequest"("agency", "status");
CREATE INDEX "GovernmentLoanAssistanceRequest_reviewedByUserId_reviewedAt_idx" ON "GovernmentLoanAssistanceRequest"("reviewedByUserId", "reviewedAt");

ALTER TABLE "GovernmentLoanAssistanceRequest" ADD CONSTRAINT "GovernmentLoanAssistanceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("employeeId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernmentLoanAssistanceRequest" ADD CONSTRAINT "GovernmentLoanAssistanceRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernmentLoanAssistanceRequest" ADD CONSTRAINT "GovernmentLoanAssistanceRequest_deductionAssignmentId_fkey" FOREIGN KEY ("deductionAssignmentId") REFERENCES "EmployeeDeductionAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

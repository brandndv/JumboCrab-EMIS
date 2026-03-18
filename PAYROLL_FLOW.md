# JumboCrab EMIS Payroll Flow (Current Schema)

This document explains the current payroll flow implemented in the schema and how it connects to attendance, earnings, and deductions.

## 1) Main Flow

1. Clerk creates a payroll run (`Payroll`) for a period.
2. System generates one payroll row per employee (`PayrollEmployee`) from attendance.
3. System/manual earning lines are stored in `PayrollEarning`.
4. System/manual deduction lines are stored in `PayrollDeduction`.
5. Manager reviews and decides (approve/reject).
6. General Manager reviews and decides (approve/reject).
7. If General Manager approves, payroll remains approved but not yet released.
8. General Manager clicks **Release** only after money is actually released.
9. Employees can view payslip data only after release.

## 2) Core Models and Responsibilities

## `Payroll`

Header for one payroll period.

- Period fields: `payrollPeriodStart`, `payrollPeriodEnd`, `payrollType`
- Workflow fields:
  - `status` (main lifecycle)
  - `managerDecision` and `gmDecision` (approval decisions)
  - review/release timestamps and remarks
  - reviewer/releaser user IDs
- Relations:
  - `payrollEmployees` -> child payslip rows
  - `attendanceRows` -> attendance rows linked to this run

## `PayrollEmployee`

One row per employee per payroll run (payslip header snapshot).

- Key linkage: `payrollId`, `employeeId`
- Snapshot attendance metrics:
  - `daysPresent`, `daysAbsent`, `daysLate`
  - `minutesWorked`, `minutesNetWorked`, `minutesOvertime`, `minutesUndertime`
- Snapshot rates:
  - `dailyRateSnapshot`
  - `ratePerMinuteSnapshot`
- Totals:
  - `grossPay`, `totalEarnings`, `totalDeductions`, `netPay`
- Relations:
  - `earnings` -> itemized `PayrollEarning`
  - `deductions` -> itemized `PayrollDeduction`
  - `attendanceRows` -> attendance rows mapped directly to this payslip row
- Constraint: unique per payroll + employee (`@@unique([payrollId, employeeId])`)

## `PayrollEarning`

Itemized earnings lines for a payroll employee row.

- `earningType`, `amount`
- Optional `minutes`, `rateSnapshot` for computed items
- `source` and `isManual` for audit
- Optional `referenceType` + `referenceId` for traceability

## `PayrollDeduction`

Itemized deductions lines for a payroll employee row.

- `deductionType`, `amount`
- Optional `minutes`, `rateSnapshot` for minute-based deduction logic
- `source` and `isManual` for audit
- Optional `referenceType` + `referenceId` for traceability

## 3) Attendance Correlation

`Attendance` has:

- `payrollPeriodId` -> links attendance row to `Payroll`
- `payrollEmployeeId` -> links attendance row to `PayrollEmployee`

This gives full traceability:

- Which payroll run included the attendance row
- Which employee payslip snapshot consumed it

## 4) Role-Based Workflow (Current Design)

1. **Clerk** generates payroll:
   - creates `Payroll` and child `PayrollEmployee` rows
   - inserts system lines in `PayrollEarning` and `PayrollDeduction`
2. **Manager** reviews:
   - updates `managerDecision`, `managerReviewedAt`, `managerReviewedByUserId`, remarks
3. **General Manager** approves/rejects:
   - updates `gmDecision`, `gmReviewedAt`, `gmReviewedByUserId`, remarks
4. **General Manager release action (separate button)**:
   - this is a separate action from approval
   - set `status` to released state only after payout is actually sent
   - set `releasedAt`, `releasedByUserId`
5. **Employee payslip visibility**:
   - show payroll rows only when parent payroll is released

## 5) Suggested Runtime Status Rule

Use this logic in actions/UI:

1. New run -> `status = DRAFT`
2. After manager approval -> keep/run `REVIEWED`
3. After GM approval (but before payout) -> keep `status = REVIEWED`
4. After GM clicks release (after actual payout) -> `status = RELEASED`
5. Rejections keep run non-released and require correction/re-review

Note: Schema still includes compatibility status values (`FINALIZED`, `VOIDED`) from earlier versions. Treat `RELEASED` as the publish state for employee payslips.

## 5.1) Rejection and Return-to-Clerk Rule

When a reviewer rejects, the payroll is returned to clerk for correction.

Manager rejection:

- Set `managerDecision = REJECTED`
- Keep `gmDecision = PENDING` (or reset to `PENDING`)
- Set `status = DRAFT` so it appears in clerk's working queue again
- Require `managerReviewRemarks` (rejection description)
- Set `managerReviewedAt` and `managerReviewedByUserId`

General Manager rejection:

- Set `gmDecision = REJECTED`
- Set `status = DRAFT` (returned to clerk)
- Require `gmReviewRemarks` (rejection description)
- Set `gmReviewedAt` and `gmReviewedByUserId`

How clerk knows it was returned:

- Query `status = DRAFT`
- And check either:
  - `managerDecision = REJECTED`
  - `gmDecision = REJECTED`

Suggested UI labels:

- `Returned by Manager` when `managerDecision = REJECTED`
- `Returned by General Manager` when `gmDecision = REJECTED`
- Show the corresponding review remarks as the required rejection description.

## 6) Payroll Computation Base (Phase 1)

Phase 1 payroll uses attendance-derived values first:

- Base pay from attendance/net worked logic
- Overtime from `minutesOvertime`
- Undertime deduction from `minutesUndertime`

Then totals are summarized in `PayrollEmployee`:

- `totalEarnings = sum(PayrollEarning.amount)`
- `totalDeductions = sum(PayrollDeduction.amount)`
- `grossPay = totalEarnings`
- `netPay = totalEarnings - totalDeductions`

## 7) Next Phase (Planned)

Add contribution and deduction integration by adding more deduction lines into `PayrollDeduction` (SSS/PhilHealth/Pag-IBIG/withholding/loan/etc), without redesigning the schema.

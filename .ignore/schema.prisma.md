# Prisma Schema Documentation

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// ---------- Auth / RBAC Enums ----------
enum USER_STATUS {
  SUSPENDED
  INVITED
}

enum ROLE_CODE {
  ADMIN
  GENERAL_MANAGER
  MANAGER
  CLERK
  SUPERVISOR
  EMPLOYEE
}

/// ========================= USERS =========================
model User {
  id           String      @id @default(cuid())
  email        String      @unique
  passwordHash String? // null if SSO-only/invited
  status       USER_STATUS @default(INVITED)
  displayName  String?
  lastLoginAt  DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  // Link to HR employee (optional but common)
  employeeLink EmployeeUserLink?

  // Many-to-many roles
  roles UserRole[]

  @@index([status])
}

/// ========================= ROLES =========================
model Role {
  id        String    @id @default(cuid())
  code      ROLE_CODE @unique // ADMIN, PAYROLL, HR, MANAGER, EMPLOYEE
  name      String
  createdAt DateTime  @default(now())

  users UserRole[]
}

/// Pivot: User ↔ Role (many-to-many)
model UserRole {
  userId     String
  roleId     String
  assignedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([roleId])
}

/// Map a user account to an Employee record (1–1)
model EmployeeUserLink {
  userId     String   @unique
  employeeId String   @unique
  createdAt  DateTime @default(now())

  user     User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
}

model EmployeeInformation {
  firstName                    String
  lastName                     String
  middleName                   String?
  birthdate                    DateTime
  address                      String?
  startDate                    DateTime
  endDate                      DateTime?
  position                     String
  department                   String
  civilStatus                  CIVIL_STATUS
  createdAt                    DateTime                       @default(now())
  email                        String?
  employeeCode                 String                         @unique
  employeeId                   String                         @id @default(cuid())
  img                          String?
  nationality                  String
  phone                        String?
  updatedAt                    DateTime                       @updatedAt
  sex                          GENDER
  employmentStatus             EMPLOYMENT_STATUS
  currentStatus                CURRENT_STATUS
  employeeContributionSettings EmployeeContributionSettings[]
  governmentId                 EmployeeGovernmentId?
  Shift                        Shift?                         @relation(fields: [shiftShiftId], references: [shiftId])
  shiftShiftId                 Int?
  EmployeeHalfMonthAssignment  EmployeeHalfMonthAssignment[]
  EmployeeShiftOverride        EmployeeShiftOverride[]
  Attendance                   Attendance[]
  Punch                        Punch[]

  PayrollEntry         PayrollEntry[]
  EmployeeCompensation EmployeeCompensation[]
  EmployeeQrCredential EmployeeQrCredential?
  AdhocPayItem         AdhocPayItem[]
  EmployeeUserLink     EmployeeUserLink?
  MemoRecipient        MemoRecipient[]
}

model EmployeeGovernmentId {
  employeeGovernmentId Int                 @id @default(autoincrement())
  employeeId           String              @unique
  sssNumber            String?             @unique
  philhealthNumber     String?             @unique
  pagibigNumber        String?             @unique
  tinNumber            String?             @unique
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
  employee             EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
}

model EmployeeContributionSettings {
  id             String              @id @default(cuid())
  employeeId     String
  agency         GOVERNMENT_AGENCY
  employeeAmount Decimal             @db.Decimal(12, 2)
  employerAmount Decimal             @db.Decimal(12, 2)
  isActive       Boolean             @default(true)
  applyMode      CONTRIBUTION_MODE
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  employee       EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)

  @@unique([employeeId, agency])
}

/// ========================= SHIFT CATALOG =========================
/// Reusable shift templates (many employees can share the same shift)

model Shift {
  shiftId            Int     @id @default(autoincrement())
  code               String  @unique // e.g., "MORNING", "AFTERNOON"
  name               String
  startMinutes       Int // minutes since midnight (e.g., 9:00 -> 540)
  endMinutes         Int // e.g., 18:00 -> 1080
  spansMidnight      Boolean @default(false) // true if crosses midnight
  breakMinutesUnpaid Int     @default(0)
  paidHoursPerDay    Decimal @db.Decimal(5, 2) // e.g., 8.00
  isActive           Boolean @default(true)
  notes              String?

  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  EmployeeInformation   EmployeeInformation[]
  SchedulePatternWeekly SchedulePatternWeekly[]
  EmployeeShiftOverride EmployeeShiftOverride[]
  Attendance            Attendance[]

  patternsSun SchedulePatternWeekly[] @relation("SPW_sun")
  patternsMon SchedulePatternWeekly[] @relation("SPW_mon")
  patternsTue SchedulePatternWeekly[] @relation("SPW_tue")
  patternsWed SchedulePatternWeekly[] @relation("SPW_wed")
  patternsThu SchedulePatternWeekly[] @relation("SPW_thu")
  patternsFri SchedulePatternWeekly[] @relation("SPW_fri")
  patternsSat SchedulePatternWeekly[] @relation("SPW_sat")
}

/// ========================= WEEKLY PATTERN (WIDE) =========================
/// One shift per weekday; NULL = rest day

model SchedulePatternWeekly {
  id   String @id @default(cuid())
  code String @unique
  name String

  sunShiftId Int?
  monShiftId Int?
  tueShiftId Int?
  wedShiftId Int?
  thuShiftId Int?
  friShiftId Int?
  satShiftId Int?

  sunShift Shift? @relation("SPW_sun", fields: [sunShiftId], references: [shiftId])
  monShift Shift? @relation("SPW_mon", fields: [monShiftId], references: [shiftId])
  tueShift Shift? @relation("SPW_tue", fields: [tueShiftId], references: [shiftId])
  wedShift Shift? @relation("SPW_wed", fields: [wedShiftId], references: [shiftId])
  thuShift Shift? @relation("SPW_thu", fields: [thuShiftId], references: [shiftId])
  friShift Shift? @relation("SPW_fri", fields: [friShiftId], references: [shiftId])
  satShift Shift? @relation("SPW_sat", fields: [satShiftId], references: [shiftId])

  isActive                    Boolean                       @default(true)
  createdAt                   DateTime                      @default(now())
  updatedAt                   DateTime                      @updatedAt
  Shift                       Shift?                        @relation(fields: [shiftShiftId], references: [shiftId])
  shiftShiftId                Int?
  EmployeeHalfMonthAssignment EmployeeHalfMonthAssignment[]
}

/// ========================= HALF-MONTH ASSIGNMENT =========================
/// Exactly one assignment per employee per half-month (1–15, 16–EOM).
/// It points to a weekly pattern (base plan). Overrides can replace per date.

model EmployeeHalfMonthAssignment {
  id              String       @id @default(cuid())
  employeeId      String
  year            Int
  month           Int // 1..12
  half            HALF
  patternType     PATTERN_TYPE // for future-proofing; currently WEEKLY
  weeklyPatternId String?

  reason    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee      EmployeeInformation    @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  weeklyPattern SchedulePatternWeekly? @relation(fields: [weeklyPatternId], references: [id])

  @@unique([employeeId, year, month, half])
  @@index([employeeId, year, month, half])
}

/// ========================= PER-DATE OVERRIDE =========================
/// One-day exception that replaces the weekly/half-month plan.

model EmployeeShiftOverride {
  id         String   @id @default(cuid())
  employeeId String
  workDate   DateTime // use date part; anchor on shift start day
  shiftId    Int? // NULL = day off
  source     String // e.g., "REQUEST_APPROVED", "MANUAL"
  note       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  shift    Shift?              @relation(fields: [shiftId], references: [shiftId])

  @@unique([employeeId, workDate]) // ensures one shift per day
  @@index([workDate])
}

/// ========================= ATTENDANCE (DAILY) =========================
/// Stores expected snapshot + actual punches + computed variances.

model Attendance {
  id         String            @id @default(cuid())
  employeeId String
  workDate   DateTime
  status     ATTENDANCE_STATUS

  // Expected (snapshot)
  expectedShiftId       Int?
  scheduledStartMinutes Int?
  scheduledEndMinutes   Int?
  paidHoursPerDay       Decimal? @db.Decimal(5, 2)

  // Actuals
  actualInAt    DateTime?
  actualOutAt   DateTime?
  workedMinutes Int?

  // Variances
  lateMinutes             Int @default(0)
  undertimeMinutes        Int @default(0)
  overtimeMinutesRaw      Int @default(0)
  overtimeMinutesApproved Int @default(0)
  nightMinutes            Int @default(0)

  // Posting/lock
  isLocked        Boolean @default(false)
  payrollPeriodId String? // link when posted (optional)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee      EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  expectedShift Shift?              @relation(fields: [expectedShiftId], references: [shiftId])

  @@unique([employeeId, workDate])
  @@index([employeeId, workDate])
  @@index([workDate])
}

/// ========================= PUNCH (RAW LOGS) =========================
model Punch {
  id         String   @id @default(cuid())
  employeeId String
  punchedAt  DateTime
  source     String // "ZKTECO" | "WEBCAM" | "MANUAL"
  deviceId   String?
  extId      String? // device log id (optional)
  rawJson    Json?

  createdAt DateTime @default(now())

  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  // @@unique([source, deviceId, extId]) // enable if devices provide stable IDs

  @@index([employeeId, punchedAt])
  @@index([punchedAt])
}

model Request {
  id          String         @id @default(cuid())
  kind        REQUEST_KIND
  status      REQUEST_STATUS @default(PENDING)
  requesterId String
  approverId  String?
  decidedAt   DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // 1-1 subtype links (exactly one is set)
  leave    LeaveRequestData?
  schedule ScheduleRequestData?
  cashAdv  CashAdvanceRequestData?

  @@index([kind, status])
  @@index([requesterId, status])
}

// ---- subtype tables (structure stays like your current ones) ----

model LeaveRequestData {
  requestId String     @id
  type      LEAVE_TYPE
  startDate DateTime
  endDate   DateTime
  paid      Boolean    @default(true)
  reason    String?

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
}

model ScheduleRequestData {
  requestId        String       @id
  type             REQUEST_TYPE
  workDateFrom     DateTime
  workDateTo       DateTime
  requesterShiftId Int?
  partnerId        String?
  partnerShiftId   Int?
  note             String?

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
}

model CashAdvanceRequestData {
  requestId            String            @id
  amountRequested      Decimal           @db.Decimal(12, 2)
  mode                 CASH_ADVANCE_MODE @default(NEXT_PAYROLL)
  installments         Int?
  fixedAmount          Decimal?          @db.Decimal(12, 2)
  // Approval-time frozen fields/progress (Option A)
  approvedAmount       Decimal?          @db.Decimal(12, 2)
  perInstallmentAmount Decimal?          @db.Decimal(12, 2)
  remainingBalance     Decimal?          @db.Decimal(12, 2)
  installmentsPaid     Int               @default(0)
  lastDeductedPeriodId String?
  isClosed             Boolean           @default(false)
  reason               String?

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
}

/// ========================= HOLIDAY =========================
/// Drives status/OT rules for Attendance on specific dates.

model Holiday {
  id        String   @id @default(cuid())
  date      DateTime @unique // date-only; store at 00:00
  name      String
  kind      HOLIDAY // "REGULAR" | "SPECIAL" (or enum if you prefer)
  isWorking Boolean  @default(false) // true if company expects work that day

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PayrollPeriod {
  id          String    @id @default(cuid())
  code        String    @unique // e.g., "2025-10-H1"
  periodStart DateTime // inclusive
  periodEnd   DateTime // inclusive
  payoutDate  DateTime?
  status      String // "OPEN" | "POSTED"

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  PayrollEntry PayrollEntry[]
  AdhocPayItem AdhocPayItem[]
}

/// ========================= PAYROLL ENTRY (payslip header) =========================
model PayrollEntry {
  id              String @id @default(cuid())
  payrollPeriodId String
  employeeId      String

  // Snapshots / rollups (store what you need; these are common)
  basicPay             Decimal @default(0) @db.Decimal(12, 2) //420php
  overtimePay          Decimal @default(0) @db.Decimal(12, 2)
  nightDiffPay         Decimal @default(0) @db.Decimal(12, 2)
  holidayPay           Decimal @default(0) @db.Decimal(12, 2)
  leavePay             Decimal @default(0) @db.Decimal(12, 2)
  lateDeduction        Decimal @default(0) @db.Decimal(12, 2)
  undertimeDeduction   Decimal @default(0) @db.Decimal(12, 2)
  govContribEmployee   Decimal @default(0) @db.Decimal(12, 2) // sum of SSS/PH/HDMF EE share
  govContribEmployer   Decimal @default(0) @db.Decimal(12, 2) // sum of ER share (for reports)
  cashAdvanceDeduction Decimal @default(0) @db.Decimal(12, 2)
  otherEarnings        Decimal @default(0) @db.Decimal(12, 2)
  otherDeductions      Decimal @default(0) @db.Decimal(12, 2)

  grossPay        Decimal @default(0) @db.Decimal(12, 2) // sum earnings
  totalDeductions Decimal @default(0) @db.Decimal(12, 2) // sum deductions
  netPay          Decimal @default(0) @db.Decimal(12, 2) // gross - deductions

  // Audit / status
  isPosted  Boolean   @default(false) // mirrors PayrollPeriod status but per-entry safety
  postedAt  DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // Relations
  period          PayrollPeriod       @relation(fields: [payrollPeriodId], references: [id], onDelete: Cascade)
  employee        EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  items           PayrollLineItem[]
  PayslipDocument PayslipDocument?

  @@unique([payrollPeriodId, employeeId]) // one payslip per employee per period
  @@index([employeeId, payrollPeriodId])
}

/// ========================= PAYROLL LINE ITEMS =========================
model PayrollLineItem {
  id             String        @id @default(cuid())
  payrollEntryId String
  kind           PAYITEM_KIND // EARNING or DEDUCTION
  type           PAYITEM_TYPE? // optional enum bucket
  code           String // e.g., "BASIC", "OT125", "SSS_EE", "CA"
  label          String // human-readable on payslip
  amount         Decimal       @db.Decimal(12, 2)

  // Optional pointers to source data for audit
  attendanceId          String? // if derived from a specific day’s attendance
  cashAdvanceRequestId  String? // if this line repays a cash advance
  contributionSettingId String? // if derived from EmployeeContributionSettings.id

  createdAt DateTime @default(now())

  entry PayrollEntry @relation(fields: [payrollEntryId], references: [id], onDelete: Cascade)
  // Soft links (no FK if you prefer; if you want FKs, add the relations below and ensure models exist):
  // attendance Attendance?            @relation(fields: [attendanceId], references: [id])
  // cashAdvance CashAdvanceRequest?   @relation(fields: [cashAdvanceRequestId], references: [id])
  // contribSetting EmployeeContributionSettings? @relation(fields: [contributionSettingId], references: [id])

  @@index([payrollEntryId])
  @@index([code])
  @@index([kind, type])
}

// Store file for each posted PayrollEntry so employees can view/download
model PayslipDocument {
  id             String    @id @default(cuid())
  payrollEntryId String    @unique // 1:1 with the payslip header
  fileUrl        String // e.g., S3 path or /storage/...
  fileHash       String? // optional integrity check (e.g., SHA256)
  mimeType       String    @default("application/pdf")
  generatedAt    DateTime  @default(now())
  generatedById  String? // User.id who generated (optional)
  viewedCount    Int       @default(0)
  lastViewedAt   DateTime?

  entry PayrollEntry @relation(fields: [payrollEntryId], references: [id], onDelete: Cascade)

  @@index([generatedAt])
}

model EmployeeCompensation {
  id                  String      @id @default(cuid())
  employeeId          String
  salaryType          SALARY_TYPE
  baseRate            Decimal     @db.Decimal(12, 2) // meaning depends on salaryType
  effectiveFrom       DateTime
  effectiveTo         DateTime? // null = current
  standardHoursPerDay Decimal     @default(8.00) @db.Decimal(5, 2) // for DAILY → hourly calc
  standardDaysPerWeek Decimal     @default(6.00) @db.Decimal(4, 2) // for MONTHLY proration if needed
  notes               String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)

  // one active row per date; enforce in app (or via check)
  @@index([employeeId, effectiveFrom, effectiveTo])
}

model AdhocPayItem {
  id              String    @id @default(cuid())
  employeeId      String
  // Optional: bind directly to a payroll period; if null, it’s “unassigned” and
  // your generator can pick it up for the next OPEN period that covers the date.
  payrollPeriodId String?
  // Optional date anchor (for audit / reports); doesn’t have to be inside period
  referenceDate   DateTime?

  kind   PAYITEM_KIND // EARNING or DEDUCTION
  code   String // e.g., "BONUS", "MEAL", "UNIFORM", "ADJUSTMENT"
  label  String // human-readable line label on payslip
  amount Decimal      @db.Decimal(12, 2)

  // Workflow
  status          String  @default("PENDING") // PENDING | APPLIED | CANCELED
  createdByUserId String?
  note            String?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  appliedAt DateTime?

  // Relations
  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  period   PayrollPeriod?      @relation(fields: [payrollPeriodId], references: [id], onDelete: SetNull)

  @@index([employeeId, status])
  @@index([payrollPeriodId, status])
  @@index([referenceDate])
}

/// ========================= COMPANY TIMEKEEPING POLICY =========================
/// One row (or per-site if you add siteId later). Keeps all the knobs your classifier needs.
model TimekeepingPolicy {
  id   String @id @default(cuid())
  name String @unique

  // Grace / windows (minutes)
  lateGraceMinutes       Int @default(0)
  earlyLeaveGraceMinutes Int @default(0)
  maxEarlyInBeforeStart  Int @default(60) // how early a punch can still count as IN
  otWindowAfterEnd       Int @default(120) // accept OUT/OT up to this after scheduled end

  // Night Differential window (24h clock minutes since midnight)
  ndStartMinutes Int @default(1320) // 22:00 = 22*60
  ndEndMinutes   Int @default(360) // 06:00 = 6*60 (wrap across midnight)

  // Rounding
  roundingModeIn  ROUNDING_MODE @default(NONE)
  roundingModeOut ROUNDING_MODE @default(NONE)

  // Auto-close policy
  autoCloseMissingOut     Boolean @default(false)
  autoCloseAtScheduledEnd Boolean @default(true)

  // Attendance generation
  precreateAttendance Boolean @default(true)

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  OvertimeRate OvertimeRate[]
}

/// ========================= OVERTIME / PREMIUM RATES =========================
/// Flexible table for multipliers. Query the best-matching row for context.
model OvertimeRate {
  id          String        @id @default(cuid())
  policyId    String
  kind        OVERTIME_KIND // REGULAR, NIGHT, HOLIDAY_REG, etc.
  multiplier  Decimal       @db.Decimal(5, 2) // e.g., 1.25, 1.30, 2.00
  appliesFrom DateTime      @default(now()) // effective dating optional
  appliesTo   DateTime?

  // Optional applicability filters (null = any)
  dayOfWeek       Int? // 0=Sun..6=Sat
  startMinutesGte Int? // restrict by time windows if needed
  endMinutesLt    Int?

  policy TimekeepingPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@index([policyId, kind])
}

/// ========================= TIMEKEEPING DEVICES (ZKTeco, Kiosks) =========================

model TimeDevice {
  id        String      @id @default(cuid())
  code      String      @unique // e.g., "ZK1-Lobby"
  type      DEVICE_TYPE
  ipAddress String?
  serialNo  String?
  location  String?
  isActive  Boolean     @default(true)

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  TimeDeviceApiKey TimeDeviceApiKey?
  QrScanLog        QrScanLog[]
}

// Kiosk/API key for devices (ties to your existing TimeDevice)
model TimeDeviceApiKey {
  id         String    @id @default(cuid())
  deviceId   String    @unique
  keyHash    String // hash of the API key (never store plaintext)
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?

  device TimeDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)
}

// One active QR credential per employee (can rotate/regenerate)

model EmployeeQrCredential {
  id         String    @id @default(cuid())
  employeeId String    @unique
  algo       QR_ALGO   @default(HMAC_SHA256)
  secretEnc  String // encrypted secret (for HMAC) or private key enc if using Ed25519; or store publicKey instead
  publicKey  String? // required if using Ed25519
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  rotatedAt  DateTime?
  revokedAt  DateTime?

  employee  EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)
  QrScanLog QrScanLog[]
}

// Log every QR scan attempt (for audit/debugging)

model QrScanLog {
  id           String         @id @default(cuid())
  employeeId   String?
  credentialId String?
  deviceId     String?
  when         DateTime       @default(now())
  result       QR_SCAN_RESULT
  reason       String?
  ip           String?
  payloadHash  String? // hash of submitted blob (privacy-safe)

  // optional relations
  device     TimeDevice?           @relation(fields: [deviceId], references: [id])
  credential EmployeeQrCredential? @relation(fields: [credentialId], references: [id])
}

model Memo {
  id     String      @id @default(cuid())
  title  String
  body   String // plain/rich text you store
  status MEMO_STATUS @default(DRAFT)
  scope  MEMO_SCOPE  @default(ALL)

  publishAt DateTime? // when it becomes visible
  expiresAt DateTime? // optional auto-archive

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  recipients MemoRecipient[]

  @@index([status, publishAt])
  @@index([expiresAt])
}

model MemoRecipient {
  id             String                @id @default(cuid())
  memoId         String
  employeeId     String
  status         MEMO_RECIPIENT_STATUS @default(UNREAD)
  readAt         DateTime?
  acknowledgedAt DateTime?
  requireAck     Boolean               @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memo     Memo                @relation(fields: [memoId], references: [id], onDelete: Cascade)
  employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)

  @@unique([memoId, employeeId])
  @@index([employeeId, status])
}

model ReportExport {
  id          String    @id @default(cuid())
  type        String // "PAYROLL_SUMMARY", "PAYSLIP_ZIP", "ATTENDANCE_DAILY", etc.
  paramsJson  Json // exact filters used when generated
  fileUrl     String // where the CSV/PDF/ZIP is stored
  mimeType    String? // "text/csv", "application/pdf", "application/zip"
  requestedBy String? // User.id (optional)
  generatedAt DateTime  @default(now())
  expiresAt   DateTime? // optional auto-cleanup date
  note        String?

  @@index([type, generatedAt])
  @@index([requestedBy, generatedAt])
}

enum GENDER {
  MALE
  FEMALE
}

enum CIVIL_STATUS {
  SINGLE
  MARRIED
  DIVORCED
  WIDOWED
}

enum EMPLOYMENT_STATUS {
  REGULAR
  PROBATIONARY
  TRAINING
}

enum CURRENT_STATUS {
  ACTIVE
  ON_LEAVE
  VACATION
  SICK_LEAVE
}

enum GOVERNMENT_AGENCY {
  SSS
  PHILHEALTH
  PAGIBIG
}

enum CONTRIBUTION_MODE {
  SPLIT_EVEN
  MONTHLY
}

enum SHIFT_TYPE {
  MORNING_SHIFT
  AFTERNOON_SHIFT
}

enum PATTERN_TYPE {
  WEEKLY
  HALF_MONTH
}

enum HALF {
  FIRST
  SECOND
}

enum ATTENDANCE_STATUS {
  PRESENT
  ABSENT
  RESTDAY
  LEAVE
  HOLIDAY_WORK
}

enum HOLIDAY {
  REGULAR
  SPECIAL
}

enum REQUEST_STATUS {
  PENDING
  APPROVED
  REJECTED
  CANCELED
}

enum REQUEST_TYPE {
  SHIFT_CHANGE
  SHIFT_SWAP
}

enum REQUEST_KIND {
  LEAVE
  SCHEDULE
  CASH_ADVANCE
}

enum LEAVE_TYPE {
  VL
  SL
  OTHERS
}

enum CASH_ADVANCE_MODE {
  NEXT_PAYROLL
  INSTALLMENTS
  FIXED_AMOUNT
}

enum PAYITEM_KIND {
  EARNING
  DEDUCTION
}

/// Optional: keep this flexible; you can expand later or just use `code` string on the line
enum PAYITEM_TYPE {
  BASIC
  OVERTIME
  NIGHT_DIFF
  HOLIDAY_PAY
  LEAVE_PAY
  LATE_DEDUCT
  UNDERTIME_DEDUCT
  SSS
  PHILHEALTH
  PAGIBIG
  CASH_ADVANCE
  ADJUSTMENT
  OTHER
}

enum SALARY_TYPE {
  MONTHLY
  DAILY
  HOURLY
}

enum OVERTIME_KIND {
  REGULAR
  NIGHT
  HOLIDAY_REG
  HOLIDAY_SPEC
  RESTDAY
}

enum ROUNDING_MODE {
  NONE
  NEAREST_1M
  NEAREST_5M
  NEAREST_15M
  UP_5M
  DOWN_5M
}

enum DEVICE_TYPE {
  ZKTECO
  FINGERPRINT_KIOSK
  WEBCAM_KIOSK
  MANUAL_IMPORT
}

enum QR_ALGO {
  HMAC_SHA256
  ED25519
}

enum QR_SCAN_RESULT {
  ACCEPTED
  REJECTED_EXPIRED
  REJECTED_BAD_SIG
  REJECTED_INACTIVE
  REJECTED_DEVICE
  REJECTED_OTHER
}

enum MEMO_STATUS {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum MEMO_PRIORITY {
  NORMAL
  IMPORTANT
  URGENT
}

enum MEMO_SCOPE {
  ALL
  DEPARTMENTS
  EMPLOYEES
}

// audience targeting mode

enum MEMO_RECIPIENT_STATUS {
  UNREAD
  READ
  ACKNOWLEDGED
}

// /// ========================= SCHEDULE REQUEST (CHANGE / SWAP) =========================
// /// Minimal workflow object to approve and materialize EmployeeShiftOverride rows.
// model ScheduleRequest {
//   id               String         @id @default(cuid())
//   type             REQUEST_TYPE
//   status           REQUEST_STATUS @default(PENDING)
//   requesterId      String
//   partnerId        String? // required if type = SHIFT_SWAP
//   workDateFrom     DateTime // support single day or range
//   workDateTo       DateTime
//   // Desired shifts (for change or swap)
//   requesterShiftId Int? // target shift for requester
//   partnerShiftId   Int? // target shift for partner (if swap)
//   note             String?
//   approverId       String?
//   decidedAt        DateTime?

//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt

//   requester                     EmployeeInformation  @relation("SR_Requester", fields: [requesterId], references: [employeeId], onDelete: Cascade)
//   partner                       EmployeeInformation? @relation("SR_Partner", fields: [partnerId], references: [employeeId])
//   EmployeeInformation           EmployeeInformation? @relation(fields: [employeeInformationEmployeeId], references: [employeeId])
//   employeeInformationEmployeeId String?

//   // @@index([type, status, workDateFrom, workDateTo])
//   @@index([requesterId, workDateFrom, workDateTo])
// }

/// ========================= CASH ADVANCE REQUEST =========================
/// One row per request. When APPROVED, you can start deducting against it.

// model CashAdvanceRequest {
//   id              String         @id @default(cuid())
//   employeeId      String
//   amountRequested Decimal        @db.Decimal(12, 2)
//   reason          String?
//   status          REQUEST_STATUS @default(PENDING) // PENDING | APPROVED | REJECTED | CANCELED
//   approverId      String?
//   decidedAt       DateTime?
//   requestedAt     DateTime       @default(now())

//   // Repayment preference
//   mode          CASH_ADVANCE_MODE @default(NEXT_PAYROLL)
//   installments  Int? // if INSTALLMENTS (e.g., 3)
//   fixedAmount   Decimal?          @db.Decimal(12, 2) // if FIXED_AMOUNT per cutoff
//   startPeriodId String? // optional first PayrollPeriod to start deductions

//   // Frozen at approval
//   approvedAmount       Decimal? @db.Decimal(12, 2)
//   perInstallmentAmount Decimal? @db.Decimal(12, 2) // approvedAmount / installments (rounded by your rule)

//   // Progress (updated each payroll post)
//   remainingBalance     Decimal? @db.Decimal(12, 2)
//   installmentsPaid     Int      @default(0)
//   lastDeductedPeriodId String?
//   isClosed             Boolean  @default(false)

//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt

//   employee EmployeeInformation @relation(fields: [employeeId], references: [employeeId], onDelete: Cascade)

//   @@index([employeeId, status])
//   @@index([requestedAt])
// }

```

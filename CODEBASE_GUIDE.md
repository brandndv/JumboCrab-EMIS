# JumboCrab EMIS Codebase Guide

## What This Project Is

JumboCrab EMIS is a role-based employee management and payroll system built with Next.js, React, Prisma, and PostgreSQL.

At a high level, the app manages:

- user accounts and role-based access
- employee records
- departments and positions
- schedules, attendance, and kiosk clocking
- contributions and government IDs
- deductions and deduction assignments
- violations
- employee request workflows
- payroll generation, review, release, and payslips
- role-specific dashboards

This is not a thin CRUD project. A lot of business logic lives in server actions, especially around attendance, deductions, requests, and payroll.

## Current Supported Roles

The active application roles are:

- `admin`
- `generalManager`
- `manager`
- `supervisor`
- `employee`

Important note:

- `clerk` is no longer a supported application role
- old `/clerk/*` URLs are redirected to `/manager/*` by the route guard

The canonical app role mapping lives in `src/lib/rbac.ts`.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 7
- PostgreSQL via Prisma + `@prisma/adapter-pg`
- `iron-session` for cookie-based auth/session storage
- Radix UI primitives for dialogs, menus, selects, etc.
- Zod for validation
- PWA support via manifest, service worker registration, and offline page

## Root Architecture

The project follows a pretty consistent split:

- `src/app`
  route files, layouts, and page entrypoints
- `src/components`
  UI components and feature-specific page content
- `src/actions`
  server actions and business logic
- `src/lib`
  shared infrastructure and helpers
- `src/types`
  typed payloads used between actions and UI
- `prisma`
  schema and migrations
- `scripts`
  seed and maintenance scripts

The most important idea in this repo is:

- App Router pages are mostly thin wrappers
- feature logic is usually in `src/actions/*`
- feature UI is usually in `src/features/*`

## Naming Quirks To Know Early

There are a few naming details worth knowing:

- both `middleware.ts` and `proxy.ts` export the same shared route guard
- many feature folders use a `manage-*` prefix because they group admin-style module screens and helpers together

The older typo-based feature paths were refactored into the current `src/features` and `src/features/manage-employees` structure.

## Directory Map

### `src/app`

Main route tree.

- `(auth)`
  public auth routes such as `/sign-in`
- `(users)`
  authenticated app shell with sidebar/header
- `(users)/(admin)/admin`
  admin routes
- `(users)/(generalManager)/generalManager`
  general manager routes
- `(users)/(manager)/manager`
  manager routes
- `(users)/(supervisor)/supervisor`
  supervisor routes
- `(users)/(employee)/employee`
  employee routes
- `kiosk/clock`
  kiosk attendance flow
- `offline`
  offline PWA page
- `api/uploads/employee-photo`
  upload route for employee photos

### `src/features`

Feature UI layer.

Main groups include:

- `dashboard`
- `manage-attendance`
- `manage-contributions`
- `manage-deductions`
- `manage-employees`
- `manage-organization`
- `manage-payroll`
- `manage-requests`
- `manage-users`
- `manage-violations`
- `sidebar-provider`
- `header-provider`
- `auth`
- `account`

### `src/actions`

This is where most business behavior lives.

Important action groups:

- `auth`
- `attendance`
- `contributions`
- `deductions`
- `employees`
- `organization`
- `payroll`
- `requests`
- `schedule`
- `users`
- `violations`

### `src/lib`

Shared infrastructure and computation helpers.

Important files:

- `auth.ts`
- `auth-utils.ts`
- `db.ts`
- `prisma.ts`
- `rbac.ts`
- `route-guard.ts`
- `attendance.ts`
- `schedule.ts`
- `timezone.ts`
- `payroll/helpers.ts`

### `prisma`

- `schema.prisma`
- many timestamped migrations

Recent migration history shows this codebase has evolved significantly in:

- payroll
- deductions
- requests
- violations
- clerk-role removal

### `scripts`

Useful for local demo data:

- `seedEmployees.ts`
- `seedPayrollBimonthly.ts`
- `seedGmAnd43Employees.ts`
- `seedAttendanceTwoBimonthly.ts`
- `backfill-punch-links.mjs`

## App Shell And Routing Model

### Root behavior

`src/app/page.tsx`:

- checks the session
- redirects signed-in users to their role home
- redirects anonymous users to `/sign-in`

### Global layout

`src/app/layout.tsx` provides:

- fonts
- theme provider
- PWA registration
- online/offline status helpers

### Authenticated layout

`src/app/(users)/layout.tsx` provides:

- shared sidebar
- shared header
- main app frame for all signed-in users

That means all authenticated role screens inherit a common shell.

### Role layouts

Each role subtree also has its own layout guard.

Examples:

- `src/app/(users)/(admin)/admin/layout.tsx`
- `src/app/(users)/(manager)/manager/layout.tsx`
- `src/app/(users)/(employee)/employee/layout.tsx`

These layouts:

- read the session on the server
- normalize the current role
- redirect unauthenticated users to `/sign-in`
- redirect wrong-role users back to their own home path

This is an additional protection layer on top of middleware/proxy.

## Auth And Session Flow

### Main auth implementation

`src/lib/auth.ts` handles:

- password hashing with `crypto.scrypt`
- password verification
- `iron-session` configuration
- session retrieval
- sign-in user lookup against Prisma

Session cookie name:

- `jumbo-auth`

### Server-side auth actions

`src/actions/auth/auth-action.ts` handles:

- sign-in
- sign-out
- user creation
- role normalization between app roles and Prisma enum roles

### Client-side session access

`src/hooks/use-session.ts`:

- calls `fetchSession()` from `src/actions/auth/session-action.ts`
- normalizes the role
- exposes convenience getters like `isAdmin`, `isManager`, etc.

`fetchSession()` also enriches the session with employee info:

- employee id
- name
- department
- position
- daily rate

That makes the client session more useful than the raw session cookie.

## Route Protection And RBAC

### Middleware/proxy

The shared logic lives in `src/lib/route-guard.ts`.

It is exported from:

- `middleware.ts`
- `proxy.ts`

The route guard does these jobs:

- allows public paths such as `/`, `/sign-in`, `/offline`, `/kiosk`
- reads and unseals the auth cookie
- redirects anonymous users to `/sign-in?next=...`
- enforces role-to-path alignment
- enforces canonical role paths
- redirects old `/clerk/*` paths to `/manager/*`

### RBAC model

`src/lib/rbac.ts` defines:

- supported app roles
- role normalization
- home path resolution
- allowed role rules for protected path prefixes

Important concept:

- the code distinguishes between database enum roles and normalized app roles
- route control uses normalized app roles

## Database Layer

### Prisma access

`src/lib/prisma.ts` builds the Prisma client with the Postgres adapter.

It also contains a useful runtime safeguard:

- it checks for required delegates before reusing a cached client
- this helps during local development when the schema has changed

`src/lib/db.ts` exposes a proxy-based `db` object so the rest of the code can import a stable Prisma entrypoint.

### Main domain groups in `prisma/schema.prisma`

The schema is broad. These are the important clusters:

#### Identity and people

- `User`
- `Employee`
- `Department`
- `Position`
- `EmployeeRateHistory`

#### Contributions and government IDs

- `GovernmentId`
- `EmployeeContribution`

#### Scheduling and attendance

- `Shift`
- `WeeklyPattern`
- `EmployeePatternAssignment`
- `EmployeeShiftOverride`
- `Attendance`
- `Punch`

#### Violations

- `EmployeeViolation`
- `EmployeeViolationReset`
- `ViolationAutoResetPolicy`

#### Deductions

- `DeductionType`
- `EmployeeDeductionAssignment`
- `EmployeeDeductionPayment`

#### Requests

- `CashAdvanceRequest`
- `LeaveRequest`
- `DayOffRequest`
- `ScheduleChangeRequest`
- `ScheduleSwapRequest`

#### Payroll

- `Payroll`
- `PayrollEmployee`
- `PayrollEarning`
- `PayrollDeduction`

## Business Module Overview

### 1. Employees

Files:

- `src/actions/employees/employees-action.ts`
- `src/features/manage-employees/*`

This module handles:

- employee directory
- employee create/edit/view flows
- profile tabs and richer employee detail screens
- relation links to user accounts, department, position, supervisor, contributions, deductions, payroll, and requests

### 2. Users

Files:

- `src/actions/users/users-action.ts`
- `src/features/manage-users/*`

This module handles:

- user directory
- account creation
- account-role assignment
- employee-to-user linking
- enable/disable behavior

Important current rule:

- unsupported roles should not be reintroduced casually
- the app role list no longer includes `clerk`

### 3. Organization

Files:

- `src/actions/organization/*`
- `src/features/manage-organization/*`

This module covers:

- departments
- positions
- organization structure views
- supervisor views

### 4. Attendance

Files:

- `src/actions/attendance/attendance-action.ts`
- `src/actions/attendance/kiosk-attendance-action.ts`
- `src/features/manage-attendance/*`
- `src/lib/attendance.ts`

This is one of the more logic-heavy areas.

It covers:

- daily attendance rows
- time in/out punches
- expected shift resolution
- late, undertime, overtime, break deductions
- payroll-payable minute calculation
- overrides and locks
- shift management
- weekly pattern assignment
- kiosk clocking

Attendance is a core dependency of payroll generation.

### 5. Requests

Files:

- `src/actions/requests/requests-action.ts`
- `src/features/manage-requests/*`

This module handles:

- leave requests
- day-off requests
- schedule change requests
- schedule swap requests
- cash advance requests

General workflow:

- employee creates request
- manager reviews
- related modules update as needed

Important example:

- approved cash advance requests can create deduction assignments

### 6. Deductions

Files:

- `src/actions/deductions/deductions-action.ts`
- `src/features/manage-deductions/*`

This module is split into two layers:

- deduction type definitions
- employee deduction assignments

Supported deduction frequencies:

- `ONE_TIME`
- `PER_PAYROLL`
- `INSTALLMENT`

Important behaviors:

- admin and general manager manage master deduction types
- admin and manager assign approved employee deductions
- manager/admin review deduction drafts
- installment deductions track balance and per-payroll repayment
- manual payment records exist in `EmployeeDeductionPayment`

Current manual payment behavior:

- all approved deduction types can record manual payments
- installment payments reduce remaining balance
- one-time manual payments complete the assignment
- per-payroll manual payments are logged without automatically ending the recurring assignment

### 7. Contributions

Files:

- `src/actions/contributions/contributions-action.ts`
- `src/actions/contributions/government-ids-action.ts`
- `src/features/manage-contributions/*`

This module manages:

- SSS
- PhilHealth
- Pag-IBIG
- withholding tax contribution records
- government ID reference numbers per employee

This data also feeds payroll deductions.

### 8. Violations

Files:

- `src/actions/violations/violations-action.ts`
- `src/features/manage-violations/*`

This module supports:

- violation drafting
- review
- employee violation directories
- auto-reset policy behavior
- role-specific flows for supervisor, manager, general manager, and employee views

### 9. Payroll

Files:

- `src/actions/payroll/payroll-action.ts`
- `src/features/manage-payroll/*`
- `src/lib/payroll/helpers.ts`
- `src/types/payroll.ts`

This is the most important business module in the project.

It handles:

- payroll generation
- payroll history
- review/approval/release
- payslips
- line-level payroll earnings and deductions
- deduction application
- contribution application
- one-time and installment settlement during release

Current workflow:

- manager generates payroll
- general manager approves and releases payroll
- admin can inspect history and supporting views
- employee can view own payroll and payslips

Important payroll detail:

- generation calculates earnings and deductions from attendance, contributions, and deduction assignments
- release finalizes payroll and updates related deduction states
- one-time deductions are completed at release
- installment deductions reduce remaining balance at release

### 10. Dashboards

Files:

- `src/features/dashboard/dashboard-data.ts`
- `src/features/dashboard/role-dashboard-page.tsx`

Dashboard design is shared across roles.

The system loads role-specific stats, shortcuts, and panels from a single data builder and renders them through one shared page component.

This makes dashboards easier to evolve without duplicating page shells for every role.

## How Pages Are Usually Built

The common pattern in this codebase is:

1. route file in `src/app/.../page.tsx`
2. route imports a feature component
3. feature component calls server actions
4. server action reads session, validates input, talks to Prisma, and returns `{ success, data, error }`

This means if you want to change behavior:

- look at `src/actions/*` first
- look at UI second

Do not assume the page file contains the actual business logic.

## Server Action Conventions

Many action files follow a shared style:

- `"use server"` at top
- role/session check first
- Zod validation next
- Prisma query/mutation next
- serialize DB results to plain objects
- return `{ success, data, error }`
- call `revalidatePath()` after mutations

This pattern is especially clear in:

- `src/actions/payroll/payroll-action.ts`
- `src/actions/deductions/deductions-action.ts`
- `src/actions/requests/requests-action.ts`

## UI Conventions

The UI is not structured around one giant state store.

Instead it usually uses:

- local component state
- server actions for data retrieval/mutation
- small hooks like `useSession`
- typed rows returned from actions

Many route pages are thin wrappers over a reusable component, for example:

- payroll pages
- deductions pages
- contributions pages
- employee/user screens

## Important Cross-Cutting Flows

### Payroll depends on attendance

Attendance rows, shifts, and rate history directly affect:

- base pay
- undertime deductions
- overtime pay
- payroll readiness

### Requests can create downstream records

Examples:

- approved cash advance requests can create deduction assignments
- leave approvals affect attendance/pay logic
- schedule changes and day-off requests affect shift expectations

### Deductions influence payroll and employee views

Deductions are not isolated records. They influence:

- payroll deductions
- employee deduction pages
- request flows
- dashboard summaries

## Sidebar And Navigation

Files:

- `src/features/sidebar-provider/app-sidebar.tsx`
- `src/features/sidebar-provider/nav-sidebar.tsx`
- `src/features/header-provider/header.tsx`

Navigation is role-aware.

`NavSidebar`:

- builds the menu from a static array
- filters items by role
- supports submenu role filtering per item

This is one of the first places to update when adding or removing a module.

## PWA And Offline Support

Files involved:

- `src/app/layout.tsx`
- `src/app/offline/page.tsx`
- manifest route and assets
- `RegisterSW`
- `OnlineStatus`

This project is set up to behave more like an installable internal app than a simple website.

## Local Development Commands

From `package.json`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npx prisma generate
npx prisma migrate dev
npx prisma studio
npm run prisma:seed
npm run prisma:seed:payroll:bimonthly
npm run prisma:seed:gm-43
npm run prisma:seed:attendance:2-bimonthly
```

Recommended sequence on a fresh machine:

1. install dependencies
2. set `DATABASE_URL`
3. set `SESSION_PASSWORD`
4. run Prisma migrations
5. run `npx prisma generate`
6. optionally run a seed script
7. start `npm run dev`

## Environment Assumptions

At minimum, this app expects:

- `DATABASE_URL`
- `SESSION_PASSWORD`

There may be other environment values depending on uploads or deployment setup, but those two are core.

## Suggested Onboarding Reading Order

If you are new to the repo, this order gives the fastest understanding:

1. `prisma/schema.prisma`
2. `src/lib/auth.ts`
3. `src/lib/rbac.ts`
4. `src/lib/route-guard.ts`
5. `src/app/layout.tsx`
6. `src/app/(users)/layout.tsx`
7. `src/features/sidebar-provider/nav-sidebar.tsx`
8. `src/actions/attendance/attendance-action.ts`
9. `src/actions/deductions/deductions-action.ts`
10. `src/actions/requests/requests-action.ts`
11. `src/actions/payroll/payroll-action.ts`
12. `src/features/dashboard/dashboard-data.ts`

## Practical Rules For Making Changes

### If you add a new screen

You usually need to update:

- `src/app/.../page.tsx`
- a feature component in `src/features/...`
- role navigation in `nav-sidebar.tsx`
- possibly `rbac.ts` and route guard behavior

### If you add a new business workflow

You usually need to update:

- Prisma schema
- migration
- server action
- UI component
- dashboard summary if the workflow should be visible on home screens

### If you change a role

You usually need to update:

- Prisma role usage
- `src/lib/rbac.ts`
- auth role mapping
- sidebar visibility
- route layouts
- dashboards
- any role-specific pages or redirects

### If you change payroll

Read these together:

- `src/actions/payroll/payroll-action.ts`
- `src/actions/attendance/attendance-action.ts`
- `src/actions/deductions/deductions-action.ts`
- `src/actions/contributions/contributions-action.ts`
- `src/types/payroll.ts`

Payroll changes are rarely isolated to a single file.

## Current Architectural Strengths

- strong App Router separation by role
- server actions hold most business logic in one place
- Prisma schema reflects real business domains
- dashboards are centralized instead of duplicated
- route guarding exists at both middleware and layout level
- payroll, deductions, and requests are type-driven and fairly explicit

## Current Architectural Friction Points

These are not necessarily bugs, but they are useful to know:

- some folder names are misspelled because of legacy structure
- there is a lot of business logic in a few very large action files
- payroll and attendance are tightly coupled, so changes ripple
- route count is large, so navigation and role changes need careful coverage
- build logs currently show dynamic cookie warnings for dashboard routes because they are session-based

## Good Mental Model For This Repo

Think of the project as three layers:

### Layer 1: infrastructure

- auth
- session
- prisma
- route protection
- timezone/payroll/attendance helpers

### Layer 2: business workflows

- attendance
- requests
- deductions
- contributions
- violations
- payroll

### Layer 3: role-specific presentation

- admin screens
- manager screens
- general manager screens
- supervisor screens
- employee screens
- dashboards

If you keep those three layers separate in your head, the repo becomes much easier to navigate.

## Final Summary

If you only remember a few things, remember these:

- most real logic lives in `src/actions`, not route files
- the database schema is the best single source of truth for domain understanding
- payroll is the most interconnected module
- roles and routing are enforced in multiple places
- the shared sidebar and shared dashboards are central to how users experience the app
- deductions, requests, attendance, and payroll all influence one another

If you want a next step after reading this file, start with:

- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/actions/payroll/payroll-action.ts`

import {
  NotificationEventType,
  NotificationModule,
  NotificationSeverity,
  Roles,
} from "@prisma/client";
import { createAndDispatchNotification } from "@/lib/notifications";
import type { PayrollRunDetail } from "@/types/payroll";

export async function notifyPayrollReviewers(input: {
  eventType: NotificationEventType;
  title: string;
  message: string;
  actorUserId?: string | null;
  payrollId: string;
}) {
  await createAndDispatchNotification({
    eventType: input.eventType,
    module: NotificationModule.PAYROLL,
    title: input.title,
    message: input.message,
    severity: NotificationSeverity.INFO,
    actorUserId: input.actorUserId ?? null,
    entityType: "Payroll",
    entityId: input.payrollId,
    linkHref: "/generalManager/payroll/review-payroll",
    recipients: {
      roles: [Roles.Admin, Roles.GeneralManager],
    },
    emailEligible: true,
  });
}

export async function notifyPayrollManagers(input: {
  eventType: NotificationEventType;
  title: string;
  message: string;
  actorUserId?: string | null;
  payrollId: string;
}) {
  await createAndDispatchNotification({
    eventType: input.eventType,
    module: NotificationModule.PAYROLL,
    title: input.title,
    message: input.message,
    severity:
      input.eventType.toString().includes("REJECTED")
        ? NotificationSeverity.WARNING
        : NotificationSeverity.SUCCESS,
    actorUserId: input.actorUserId ?? null,
    entityType: "Payroll",
    entityId: input.payrollId,
    linkHref: "/manager/payroll/review-payroll",
    recipients: {
      roles: [Roles.Admin, Roles.Manager],
    },
    emailEligible: true,
  });
}

export async function notifyPayrollReleased(
  detail: PayrollRunDetail,
  actorUserId?: string | null,
) {
  await createAndDispatchNotification({
    eventType: "PAYROLL_RELEASED",
    module: NotificationModule.PAYROLL,
    title: "Payroll released",
    message: "Payroll has been released successfully.",
    severity: NotificationSeverity.SUCCESS,
    actorUserId: actorUserId ?? null,
    entityType: "Payroll",
    entityId: detail.payrollId,
    linkHref: "/generalManager/payroll/payroll-history",
    recipients: {
      roles: [Roles.Admin, Roles.GeneralManager, Roles.Manager],
    },
    emailEligible: true,
  });

  await createAndDispatchNotification({
    eventType: "PAYSLIP_AVAILABLE",
    module: NotificationModule.PAYROLL,
    title: "Payslip available",
    message: "A new payslip is now available for your released payroll.",
    severity: NotificationSeverity.SUCCESS,
    actorUserId: actorUserId ?? null,
    entityType: "Payroll",
    entityId: detail.payrollId,
    linkHref: "/employee/payslip",
    recipients: {
      employeeIds: detail.employees.map((employee) => employee.employeeId),
    },
    emailEligible: true,
  });
}

import {
  NotificationEventType,
  NotificationModule,
  NotificationSeverity,
  Roles,
} from "@prisma/client";
import { createAndDispatchNotification } from "@/lib/notifications";

export async function notifyManagersOfRequest(input: {
  eventType: NotificationEventType;
  title: string;
  message: string;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
}) {
  await createAndDispatchNotification({
    eventType: input.eventType,
    module: NotificationModule.REQUESTS,
    title: input.title,
    message: input.message,
    severity: NotificationSeverity.INFO,
    actorUserId: input.actorUserId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    linkHref: "/manager/requests",
    recipients: {
      roles: [Roles.Admin, Roles.Manager],
    },
    emailEligible: false,
  });
}

export async function notifyEmployeeOfRequestDecision(input: {
  eventType: NotificationEventType;
  title: string;
  message: string;
  actorUserId?: string | null;
  employeeId: string;
  entityType: string;
  entityId: string;
  linkHref?: string;
}) {
  await createAndDispatchNotification({
    eventType: input.eventType,
    module: NotificationModule.REQUESTS,
    title: input.title,
    message: input.message,
    severity:
      input.eventType.toString().includes("REJECTED") ||
      input.eventType.toString().includes("DECLINED")
        ? NotificationSeverity.WARNING
        : NotificationSeverity.SUCCESS,
    actorUserId: input.actorUserId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    linkHref: input.linkHref ?? "/employee/requests",
    recipients: {
      employeeIds: [input.employeeId],
    },
    emailEligible: true,
  });
}

export async function notifyCoworkerOfSwapRequest(input: {
  actorUserId?: string | null;
  coworkerEmployeeId: string;
  requestId: string;
  message: string;
}) {
  await createAndDispatchNotification({
    eventType: NotificationEventType.SCHEDULE_SWAP_REQUEST_SUBMITTED,
    module: NotificationModule.REQUESTS,
    title: "Schedule swap response needed",
    message: input.message,
    severity: NotificationSeverity.INFO,
    actorUserId: input.actorUserId ?? null,
    entityType: "ScheduleSwapRequest",
    entityId: input.requestId,
    linkHref: "/employee/requests",
    recipients: {
      employeeIds: [input.coworkerEmployeeId],
    },
    emailEligible: true,
  });
}

export async function notifySwapRequester(input: {
  eventType: NotificationEventType;
  actorUserId?: string | null;
  requesterEmployeeId: string;
  requestId: string;
  title: string;
  message: string;
}) {
  await createAndDispatchNotification({
    eventType: input.eventType,
    module: NotificationModule.REQUESTS,
    title: input.title,
    message: input.message,
    severity:
      input.eventType.toString().includes("REJECTED")
        ? NotificationSeverity.WARNING
        : NotificationSeverity.SUCCESS,
    actorUserId: input.actorUserId ?? null,
    entityType: "ScheduleSwapRequest",
    entityId: input.requestId,
    linkHref: "/employee/requests",
    recipients: {
      employeeIds: [input.requesterEmployeeId],
    },
    emailEligible: true,
  });
}

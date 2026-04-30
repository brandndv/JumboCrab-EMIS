"use server";

import type { NotificationModule } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import {
  archiveNotifications,
  getUnreadNotificationCount as getUnreadNotificationCountForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationsRead as markNotificationsReadForUser,
  markNotificationsUnread as markNotificationsUnreadForUser,
} from "@/lib/notifications";

async function getSessionNotificationContext() {
  const session = await getSession();
  const role = normalizeRole(session.role);

  if (!session.isLoggedIn || !session.userId || !role) {
    return null;
  }

  return {
    userId: session.userId,
    role,
  };
}

export async function getNotifications(input?: {
  limit?: number;
  unreadOnly?: boolean;
  includeArchived?: boolean;
  module?: NotificationModule | "ALL";
}) {
  const context = await getSessionNotificationContext();
  if (!context) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  const data = await listNotificationsForUser({
    userId: context.userId,
    role: context.role,
    filters: input,
  });

  return {
    success: true,
    data,
  };
}

export async function getUnreadNotificationCount() {
  const context = await getSessionNotificationContext();
  if (!context) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  return {
    success: true,
    data: await getUnreadNotificationCountForUser(context.userId),
  };
}

export async function markNotificationsRead(input?: { ids?: string[] }) {
  const context = await getSessionNotificationContext();
  if (!context) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  await (input?.ids?.length
    ? markNotificationsReadForUser(context.userId, input.ids)
    : markAllNotificationsRead(context.userId));

  return getNotifications({
    limit: 20,
  });
}

export async function markNotificationsUnread(input: { ids: string[] }) {
  const context = await getSessionNotificationContext();
  if (!context) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  await markNotificationsUnreadForUser(context.userId, input.ids);

  return getNotifications({
    limit: 20,
  });
}

export async function archiveUserNotifications(input?: { ids?: string[] }) {
  const context = await getSessionNotificationContext();
  if (!context) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  await archiveNotifications(context.userId, input?.ids);

  return getNotifications({
    limit: 20,
  });
}

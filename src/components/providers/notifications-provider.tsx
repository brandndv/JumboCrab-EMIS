"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NotificationModule } from "@prisma/client";
import {
  archiveUserNotifications,
  getNotifications,
  markNotificationsRead,
  markNotificationsUnread,
} from "@/actions/notifications/notifications-action";
import type { NotificationFilters, NotificationListItem } from "@/lib/notifications";

type NotificationsContextValue = {
  items: NotificationListItem[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  refreshLatest: () => Promise<void>;
  fetchNotifications: (
    filters?: NotificationFilters,
  ) => Promise<{ items: NotificationListItem[]; unreadCount: number }>;
  markRead: (ids?: string[]) => Promise<void>;
  markUnread: (ids: string[]) => Promise<void>;
  archive: (ids?: string[]) => Promise<void>;
};

const DEFAULT_LIMIT = 10;

export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

function mergeNotificationItems(
  current: NotificationListItem[],
  incoming: NotificationListItem[],
) {
  const byId = new Map<string, NotificationListItem>();

  [...incoming, ...current].forEach((item) => {
    byId.set(item.id, item);
  });

  return Array.from(byId.values())
    .sort((left, right) => {
      if (left.createdAt === right.createdAt) {
        return right.id.localeCompare(left.id);
      }
      return right.createdAt.localeCompare(left.createdAt);
    })
    .slice(0, 50);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const lastSeenRef = useRef<{ createdAt: string | null; id: string | null }>({
    createdAt: null,
    id: null,
  });
  const reconnectTimerRef = useRef<number | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  const updateLastSeen = (nextItems: NotificationListItem[]) => {
    const [latest] = nextItems;
    lastSeenRef.current = {
      createdAt: latest?.createdAt ?? lastSeenRef.current.createdAt,
      id: latest?.id ?? lastSeenRef.current.id,
    };
  };

  const fetchNotifications = useCallback(async (
    filters?: NotificationFilters,
  ): Promise<{ items: NotificationListItem[]; unreadCount: number }> => {
    const result = await getNotifications({
      limit: filters?.limit ?? DEFAULT_LIMIT,
      unreadOnly: filters?.unreadOnly,
      includeArchived: filters?.includeArchived,
      module: filters?.module as NotificationModule | "ALL" | undefined,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to fetch notifications.");
    }

    return result.data;
  }, []);

  const refreshLatest = useCallback(async () => {
    const data = await fetchNotifications({
      limit: DEFAULT_LIMIT,
    });
    setItems(data.items);
    setUnreadCount(data.unreadCount);
    updateLastSeen(data.items);
  }, [fetchNotifications]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchNotifications({
          limit: DEFAULT_LIMIT,
        });
        if (!active) return;
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        updateLastSeen(data.items);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchNotifications]);

  useEffect(() => {
    let disposed = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      clearReconnect();
      const params = new URLSearchParams();
      if (lastSeenRef.current.createdAt) {
        params.set("afterCreatedAt", lastSeenRef.current.createdAt);
      }
      if (lastSeenRef.current.id) {
        params.set("afterId", lastSeenRef.current.id);
      }

      const source = new EventSource(
        `/api/notifications/stream?${params.toString()}`,
      );
      streamRef.current = source;

      source.addEventListener("open", () => {
        setConnected(true);
      });

      source.addEventListener("snapshot", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          unreadCount: number;
          items: NotificationListItem[];
          missedItems?: NotificationListItem[];
        };
        const nextItems = mergeNotificationItems(payload.items, payload.missedItems ?? []);
        setItems(nextItems);
        setUnreadCount(payload.unreadCount);
        updateLastSeen(nextItems);
      });

      source.addEventListener("notification", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          unreadCount: number;
          item: NotificationListItem;
        };
        setItems((current) => {
          const nextItems = mergeNotificationItems(current, [payload.item]);
          updateLastSeen(nextItems);
          return nextItems;
        });
        setUnreadCount(payload.unreadCount);
      });

      source.addEventListener("error", () => {
        setConnected(false);
        source.close();
        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 3_000);
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      clearReconnect();
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, []);

  const markRead = useCallback(async (ids?: string[]) => {
    if (ids?.length) {
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, readAt: item.readAt ?? now } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - ids.length));
    } else {
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: now })));
      setUnreadCount(0);
    }

    try {
      await markNotificationsRead(ids ? { ids } : undefined);
      await refreshLatest();
    } catch (error) {
      console.error("Failed to mark notifications read:", error);
      await refreshLatest();
    }
  }, [refreshLatest]);

  const markUnread = useCallback(async (ids: string[]) => {
    setItems((current) =>
      current.map((item) =>
        ids.includes(item.id) ? { ...item, readAt: null } : item,
      ),
    );
    setUnreadCount((current) => current + ids.length);

    try {
      await markNotificationsUnread({ ids });
      await refreshLatest();
    } catch (error) {
      console.error("Failed to mark notifications unread:", error);
      await refreshLatest();
    }
  }, [refreshLatest]);

  const archive = useCallback(async (ids?: string[]) => {
    if (ids?.length) {
      setItems((current) => current.filter((item) => !ids.includes(item.id)));
    } else {
      setItems([]);
      setUnreadCount(0);
    }

    try {
      await archiveUserNotifications(ids ? { ids } : undefined);
      await refreshLatest();
    } catch (error) {
      console.error("Failed to archive notifications:", error);
      await refreshLatest();
    }
  }, [refreshLatest]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount,
      loading,
      connected,
      refreshLatest,
      fetchNotifications,
      markRead,
      markUnread,
      archive,
    }),
    [
      archive,
      connected,
      fetchNotifications,
      items,
      loading,
      markRead,
      markUnread,
      refreshLatest,
      unreadCount,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

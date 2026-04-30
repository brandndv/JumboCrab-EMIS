"use client";

import Link from "next/link";
import { Bell, Circle } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useSession } from "@/hooks/use-session";
import { getNotificationsPathForRole } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function NotificationBell() {
  const { user } = useSession();
  const { items, unreadCount, loading, connected, markRead } = useNotifications();

  if (!user?.role) {
    return null;
  }

  const notificationsPath = getNotificationsPathForRole(user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative h-10 w-10 rounded-xl px-0"
          aria-label="Open notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-2xl p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base font-semibold">
            Notifications
          </DropdownMenuLabel>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle
              className={`h-2.5 w-2.5 fill-current ${
                connected ? "text-success" : "text-muted-foreground"
              }`}
            />
            {connected ? "Live" : "Reconnecting"}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[24rem] overflow-y-auto p-2">
          {loading ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : items.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                asChild
                className="mb-1 rounded-xl p-0 focus:bg-accent/50"
              >
                <Link
                  href={item.linkHref}
                  className="flex w-full flex-col gap-1 px-3 py-3"
                  onClick={() => {
                    void markRead([item.id]);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-1 text-sm font-medium">
                      {item.title}
                    </span>
                    {!item.readAt ? (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                        New
                      </Badge>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.message}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => void markRead()}
            disabled={unreadCount === 0}
          >
            Mark all read
          </Button>
          <Button asChild size="sm" className="rounded-xl">
            <Link href={notificationsPath}>View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

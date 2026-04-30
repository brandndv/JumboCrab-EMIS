"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationModule } from "@prisma/client";
import Link from "next/link";
import { Archive, Bell, MailWarning, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotifications } from "@/hooks/use-notifications";
import type { NotificationListItem } from "@/lib/notifications";

const MODULE_OPTIONS: Array<NotificationModule | "ALL"> = [
  "ALL",
  "USERS",
  "REQUESTS",
  "PAYROLL",
  "VIOLATIONS",
  "DEDUCTIONS",
  "ATTENDANCE",
  "SCHEDULE",
  "SECURITY",
  "SYSTEM",
];

function formatModuleLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (v) => v.toUpperCase());
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const { fetchNotifications, markRead, markUnread, archive, unreadCount } =
    useNotifications();
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<NotificationModule | "ALL">(
    "ALL",
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications({
        limit: 100,
        unreadOnly: showUnreadOnly,
        includeArchived,
        module: moduleFilter,
      });
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, includeArchived, moduleFilter, showUnreadOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Alert Center
          </p>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Live updates across requests, payroll, violations, deductions, and account events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{unreadCount} unread</Badge>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={() => void markRead()}>
            Mark all read
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showUnreadOnly ? "default" : "outline"}
              onClick={() => setShowUnreadOnly((current) => !current)}
            >
              Unread only
            </Button>
            <Button
              type="button"
              variant={includeArchived ? "default" : "outline"}
              onClick={() => setIncludeArchived((current) => !current)}
            >
              Include archived
            </Button>
          </div>
          <div className="w-full md:ml-auto md:max-w-xs">
            <Select
              value={moduleFilter}
              onValueChange={(value) =>
                setModuleFilter(value as NotificationModule | "ALL")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {formatModuleLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <Card className="rounded-2xl">
            <CardContent className="px-6 py-10 text-sm text-muted-foreground">
              Loading notifications...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="px-6 py-10 text-sm text-muted-foreground">
              No notifications match current filters.
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="rounded-2xl border-border/70">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    {!item.readAt ? <Badge variant="destructive">Unread</Badge> : null}
                    {item.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
                    <Badge variant="outline">{formatModuleLabel(item.module)}</Badge>
                    {item.emailStatus === "FAILED" ? (
                      <Badge variant="warning">
                        <MailWarning className="h-3 w-3" />
                        Email failed
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{formatTimestamp(item.createdAt)}</span>
                    {item.actorUsername ? <span>By {item.actorUsername}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.readAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void markUnread([item.id]).then(refresh)}
                    >
                      Mark unread
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void markRead([item.id]).then(refresh)}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void archive([item.id]).then(refresh)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                  <Button asChild size="sm">
                    <Link href={item.linkHref}>
                      <Bell className="mr-2 h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

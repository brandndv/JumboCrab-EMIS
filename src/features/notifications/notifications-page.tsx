"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NotificationModule } from "@prisma/client";
import Link from "next/link";
import {
  Archive,
  Bell,
  CheckSquare,
  MailWarning,
  MoreHorizontal,
  RefreshCcw,
  Square,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type ViewMode = "inbox" | "archived";

function formatModuleLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function moduleBadgeVariant(module: NotificationListItem["module"]) {
  switch (module) {
    case "REQUESTS":
      return "info";
    case "PAYROLL":
      return "warning";
    case "VIOLATIONS":
      return "destructive";
    case "USERS":
    case "SECURITY":
      return "secondary";
    default:
      return "outline";
  }
}

export default function NotificationsPage() {
  const { fetchNotifications, markRead, archive, unreadCount } = useNotifications();
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<NotificationModule | "ALL">(
    "ALL",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("inbox");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications({
        limit: 100,
        unreadOnly: false,
        includeArchived: viewMode === "archived",
        module: moduleFilter,
      });
      const nextItems =
        viewMode === "archived"
          ? data.items.filter((item) => Boolean(item.archivedAt))
          : data.items.filter((item) => !item.archivedAt);
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, moduleFilter, viewMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSelectedIds([]);
  }, [items, viewMode]);

  const archivedCount = useMemo(
    () => items.filter((item) => Boolean(item.archivedAt)).length,
    [items],
  );

  const applyReadState = useCallback((ids: string[]) => {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              readAt: item.readAt ?? now,
            }
          : item,
      ),
    );
  }, []);

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const applyArchiveState = useCallback((ids: string[]) => {
    const now = new Date().toISOString();
    setItems((current) =>
      current
        .map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                archivedAt: item.archivedAt ?? now,
              }
            : item,
        )
        .filter((item) => (viewMode === "archived" ? true : !ids.includes(item.id))),
    );
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  }, [viewMode]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  };

  const bulkArchive = async () => {
    if (selectedIds.length === 0) return;
    await archive(selectedIds);
    applyArchiveState(selectedIds);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(items.map((item) => item.id));
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Review updates across requests, payroll, violations, deductions,
            and account events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info" className="h-9 rounded-full px-4 text-sm">
            {unreadCount} unread
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-lg"
            onClick={() => void refresh()}
            aria-label="Refresh notifications"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="border-b border-border/70 pb-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-fit rounded-xl border border-border/70 bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setViewMode("inbox")}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
                viewMode === "inbox"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setViewMode("archived")}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
                viewMode === "archived"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Archived
            </button>
          </div>

          <div className="flex min-h-10 flex-wrap items-center justify-end gap-2">
            {viewMode === "inbox" ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg"
                onClick={toggleSelectAll}
                aria-label={allSelected ? "Clear all selections" : "Select all notifications"}
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            ) : null}

            {selectedIds.length > 0 ? (
              <>
                <p className="mx-1 text-sm font-medium text-foreground/80">
                  {selectedIds.length} selected
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-lg"
                  onClick={() => void bulkArchive()}
                  aria-label="Archive selected notifications"
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg"
                  onClick={() => setSelectedIds([])}
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : null}

            {viewMode === "archived" ? (
              <Badge variant="secondary" className="h-9 rounded-full px-4 text-sm">
                {archivedCount} archived
              </Badge>
            ) : null}

            <Select
              value={moduleFilter}
              onValueChange={(value) =>
                setModuleFilter(value as NotificationModule | "ALL")
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg sm:w-[220px]">
                <SelectValue placeholder="All modules" />
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/40">
        {loading ? (
          <div className="px-8 py-12 text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="px-8 py-12 text-sm text-muted-foreground">
            No notifications found in this tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`transition-colors hover:bg-muted/30 ${!item.readAt ? "bg-primary/5" : ""}`}
                  >
                    {viewMode === "inbox" ? (
                      <TableCell className="w-[56px] px-4 py-5 align-top sm:px-6">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(event) =>
                            toggleSelected(item.id, event.target.checked)
                          }
                          aria-label={`Select notification ${item.title}`}
                          className="h-4 w-4 rounded border-border bg-background"
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="min-w-[420px] px-2 py-5 pr-6 align-top">
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-3">
                            {!item.readAt ? (
                              <span
                                aria-hidden="true"
                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                              />
                            ) : (
                              <span
                                className="mt-1.5 h-2.5 w-2.5 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`truncate text-foreground ${!item.readAt ? "font-semibold" : "font-medium"}`}
                                >
                                  {item.title}
                                </p>
                                {item.emailStatus === "FAILED" ? (
                                  <Badge variant="warning" className="gap-1 rounded-full">
                                    <MailWarning className="h-3 w-3" />
                                    Email failed
                                  </Badge>
                                ) : null}
                              </div>
                              <p
                                className={`truncate text-sm ${!item.readAt ? "font-medium text-foreground" : "text-muted-foreground"}`}
                              >
                                {item.message}
                              </p>
                            </div>
                          </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-5 align-top">
                        <Badge
                          variant={moduleBadgeVariant(item.module)}
                          className="rounded-full px-2.5 py-0.5"
                        >
                          {formatModuleLabel(item.module)}
                        </Badge>
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap px-4 py-5 align-top text-sm ${!item.readAt ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                        {formatTimestamp(item.createdAt)}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap px-4 py-5 align-top text-sm ${!item.readAt ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                        {item.actorUsername ? `By ${item.actorUsername}` : "System"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right align-top sm:px-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 rounded-full p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={item.linkHref}
                                onClick={() => {
                                  if (!item.readAt) {
                                    void markRead([item.id]).then(() => {
                                      applyReadState([item.id]);
                                    });
                                  }
                                }}
                              >
                                <Bell className="mr-2 h-4 w-4" />
                                Open
                              </Link>
                            </DropdownMenuItem>
                            {viewMode === "inbox" ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  void archive([item.id]).then(() => {
                                    applyArchiveState([item.id]);
                                  });
                                }}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

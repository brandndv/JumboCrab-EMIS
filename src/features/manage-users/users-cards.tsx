"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserWithEmployee } from "@/lib/validations/users";
import { UsersActions } from "./users-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface UsersCardsProps {
  users: UserWithEmployee[];
  onEdit: (user: UserWithEmployee) => void;
  onDisable: (user: UserWithEmployee) => void;
  onEnable?: (user: UserWithEmployee) => void;
  onDelete?: (user: UserWithEmployee) => void;
  onView: (user: UserWithEmployee) => void;
}

const PAGE_SIZE_OPTIONS = [8, 12, 24] as const;

const buildDisplayName = (user: UserWithEmployee) => {
  const fullName = `${user.employee?.firstName ?? ""} ${
    user.employee?.lastName ?? ""
  }`.trim();
  return fullName || user.username;
};

const getSupervisesLabel = (user: UserWithEmployee) => {
  if (user.role !== "supervisor") return null;
  const label = user.employee?.department || user.employee?.position;
  return label ? `Supervises: ${label}` : null;
};

const formatJoinedDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

const getUserAvatar = (user: UserWithEmployee) =>
  (user.image as string | null | undefined) || user.employee?.img || null;

const getUserInitials = (user: UserWithEmployee) => {
  const first = user.employee?.firstName?.charAt(0) ?? user.username?.charAt(0) ?? "";
  const last = user.employee?.lastName?.charAt(0) ?? "";
  const initials = `${first}${last}`.trim();
  return initials ? initials.toUpperCase() : "U";
};

export function UsersCards({
  users,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
  onView,
}: UsersCardsProps) {
  const [pagination, setPagination] = useState<{
    datasetKey: string;
    page: number;
    pageSize: number;
  }>({
    datasetKey: "",
    page: 1,
    pageSize: PAGE_SIZE_OPTIONS[0],
  });

  const datasetKey = useMemo(
    () => users.map((user) => user.userId).join("|"),
    [users],
  );
  const pageSize = pagination.pageSize;
  const currentPage = pagination.datasetKey === datasetKey ? pagination.page : 1;
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const currentUsers = users.slice(pageStart, pageStart + pageSize);
  const showingFrom = users.length === 0 ? 0 : pageStart + 1;
  const showingTo = users.length === 0 ? 0 : Math.min(pageStart + pageSize, users.length);

  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, safeCurrentPage - 1);
    const end = Math.min(totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);

    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, index) => adjustedStart + index,
    );
  }, [safeCurrentPage, totalPages]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
        {currentUsers.map((user) => (
          <Card
            key={user.userId}
            className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[320px]"
          >
            <div className="flex-1 flex flex-col">
              <CardHeader className="p-0 pb-3">
                <div className="flex justify-between items-start w-full gap-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 shrink-0">
                      {getUserAvatar(user) && (
                        <AvatarImage
                          src={getUserAvatar(user) as string}
                          alt={buildDisplayName(user)}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-foreground line-clamp-2">
                        {buildDisplayName(user)}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.role}
                      </p>
                      {getSupervisesLabel(user) && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {getSupervisesLabel(user)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <UsersActions
                      user={user}
                      onEdit={() => onEdit(user)}
                      onDisable={() => onDisable(user)}
                      onEnable={onEnable ? () => onEnable(user) : undefined}
                      onDelete={onDelete ? () => onDelete(user) : undefined}
                    />
                  </div>
                </div>
              </CardHeader>

              <Separator className="my-2" />

              <CardContent className="p-0 flex flex-col h-full">
                <div className="space-y-3 flex-1">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center">
                      <span className="text-foreground/80 mr-2">Email:</span>
                      <span className="truncate">{user.email || "No email"}</span>
                    </div>
                    {user.employee?.employeeCode && (
                      <div className="flex items-center">
                        <span className="text-foreground/80 mr-2">Code:</span>
                        <span>{user.employee.employeeCode}</span>
                      </div>
                    )}
                    {formatJoinedDate(user.createdAt) && (
                      <div className="flex items-center">
                        <span className="text-foreground/80 mr-2">Joined:</span>
                        <span>{formatJoinedDate(user.createdAt)}</span>
                      </div>
                    )}
                  </div>

                  {user.isDisabled && (
                    <div className="flex items-center gap-2 rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-medium w-fit">
                      Disabled
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onView(user)}>
                      View
                    </Button>
                    {!user.isDisabled && (
                      <Button size="sm" onClick={() => onEdit(user)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length === 0
            ? "Showing 0 of 0 users"
            : `Showing ${showingFrom}-${showingTo} of ${users.length} users`}
        </p>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Rows per page</span>
            <span className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPagination((prev) => ({
                    ...prev,
                    datasetKey,
                    page: 1,
                    pageSize: Number(e.target.value),
                  }));
                }}
                className="h-10 min-w-[72px] appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </span>
          </label>

          {totalPages > 1 && (
            <Pagination className="m-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (safeCurrentPage > 1) {
                        setPagination((prev) => ({
                          ...prev,
                          datasetKey,
                          page: safeCurrentPage - 1,
                        }));
                      }
                    }}
                    className={
                      safeCurrentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {visiblePageNumbers[0] > 1 && (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPagination((prev) => ({
                            ...prev,
                            datasetKey,
                            page: 1,
                          }));
                        }}
                        className="cursor-pointer"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {visiblePageNumbers[0] > 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                  </>
                )}

                {visiblePageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPagination((prev) => ({
                          ...prev,
                          datasetKey,
                          page: pageNumber,
                        }));
                      }}
                      isActive={safeCurrentPage === pageNumber}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                {visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages && (
                  <>
                    {visiblePageNumbers[visiblePageNumbers.length - 1] <
                      totalPages - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPagination((prev) => ({
                            ...prev,
                            datasetKey,
                            page: totalPages,
                          }));
                        }}
                        className="cursor-pointer"
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (safeCurrentPage < totalPages) {
                        setPagination((prev) => ({
                          ...prev,
                          datasetKey,
                          page: safeCurrentPage + 1,
                        }));
                      }
                    }}
                    className={
                      safeCurrentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  );
}

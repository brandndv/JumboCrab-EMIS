"use client";

import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pencil, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserById } from "@/actions/users/users-action";
import type { UserWithEmployee } from "@/lib/validations/users";

const InfoField = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <div className="min-h-[44px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground flex items-center">
      {value ?? <span className="text-muted-foreground/70">—</span>}
    </div>
  </div>
);

const buildDisplayName = (user?: UserWithEmployee | null) => {
  const fullName = `${user?.employee?.firstName ?? ""} ${
    user?.employee?.lastName ?? ""
  }`.trim();
  return fullName || user?.username || "User";
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

const getInitials = (user?: UserWithEmployee | null) => {
  const first = user?.employee?.firstName?.[0] ?? user?.username?.[0] ?? "";
  const last = user?.employee?.lastName?.[0] ?? "";
  const initials = `${first}${last}`.trim();
  return initials || "U";
};

function getEntityName(value: unknown): string | null {
  if (typeof value === "string") return value;

  if (
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof (value as { name?: unknown }).name === "string"
  ) {
    return (value as { name: string }).name;
  }

  return null;
}

function UserViewPageContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const [user, setUser] = useState<UserWithEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const params = await paramsPromise;
        const userId = params?.id;

        if (!userId) {
          throw new Error("No user ID provided");
        }

        const { data, error: fetchError } = await getUserById(userId);

        if (fetchError || !data) {
          throw new Error(fetchError || "Failed to load user");
        }

        setUser(data as unknown as UserWithEmployee);
      } catch (err) {
        console.error("Error loading user:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load user data",
        );
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [paramsPromise]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[220px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-4 bg-red-50 rounded-md border border-destructive/30">
        <p className="text-red-600">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const displayName = buildDisplayName(user);
  const statusBadge = user.isDisabled ? (
    <Badge variant="secondary" className="bg-red-100 text-red-700">
      Disabled
    </Badge>
  ) : (
    <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
  );

  return (
    <div className="space-y-6 py-10 px-5 md:px-16 lg:px-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View user details and linked employee record
          </p>
        </div>
        {user?.userId && (
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/admin/users/${user.userId}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        <div className="border-b border-border/70 px-6 py-5 flex items-center gap-4">
          <Avatar className="h-14 w-14 ring-2 ring-primary/15">
            {(user.image || user.employee?.img) && (
              <AvatarImage
                src={(user.image as string) || (user.employee?.img as string)}
                alt={displayName}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold uppercase">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold leading-tight">
                {displayName}
              </h2>
              <Badge variant="outline" className="text-xs capitalize">
                {user.role}
              </Badge>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground truncate max-w-xl">
              {user.email}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoField label="Username" value={user.username} />
            <InfoField label="Email" value={user.email} />
            <InfoField
              label="Role"
              value={
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
              }
            />
            <InfoField
              label="Status"
              value={user.isDisabled ? "Disabled" : "Active"}
            />
            <InfoField
              label="Created"
              value={formatDate(user.createdAt) ?? "—"}
            />
            <InfoField
              label="Last Updated"
              value={formatDate(user.updatedAt) ?? "—"}
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        <div className="border-b border-border/70 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Linked Employee
            </p>
            <h3 className="text-lg font-semibold">Employee Details</h3>
          </div>
          {user.employee?.employeeId && (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/admin/employees/${user.employee.employeeId}/view`}
              >
                View Employee Record
              </Link>
            </Button>
          )}
        </div>

        {user.employee ? (
          <div className="px-6 py-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField
                label="Name"
                value={`${user.employee.firstName ?? ""} ${
                  user.employee.lastName ?? ""
                }`.trim()}
              />
              <InfoField
                label="Employee Code"
                value={user.employee.employeeCode}
              />
              <InfoField
                label="Position"
                value={getEntityName(user.employee.position) ?? "—"}
              />
              <InfoField
                label="Department"
                value={getEntityName(user.employee.department) ?? "—"}
              />
              <InfoField
                label="Employment Status"
                value={user.employee.employmentStatus}
              />
              <InfoField
                label="Current Status"
                value={
                  user.employee.currentStatus
                    ? user.employee.currentStatus.replace("_", " ")
                    : "—"
                }
              />
              <InfoField
                label="Start Date"
                value={formatDate(user.employee.startDate) ?? "—"}
              />
              {user.employee.endDate && (
                <InfoField
                  label="End Date"
                  value={formatDate(user.employee.endDate) ?? "—"}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              This user is not linked to an employee record.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function UserViewPage({ params }: { params: { id: string } }) {
  const paramsPromise = Promise.resolve(params);
  return <UserViewPageContent paramsPromise={paramsPromise} />;
}

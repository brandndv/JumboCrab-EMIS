"use client";

import { Button } from "@/components/ui/button";
import { UserWithEmployee } from "@/lib/validations/users";
import { UsersActions } from "./users-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface UsersCardsProps {
  users: UserWithEmployee[];
  onEdit: (user: UserWithEmployee) => void;
  onDisable: (user: UserWithEmployee) => void;
  onEnable?: (user: UserWithEmployee) => void;
  onDelete?: (user: UserWithEmployee) => void;
  onView: (user: UserWithEmployee) => void;
}

const buildDisplayName = (user: UserWithEmployee) => {
  const fullName = `${user.employee?.firstName ?? ""} ${
    user.employee?.lastName ?? ""
  }`.trim();
  return fullName || user.username;
};

const formatJoinedDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export function UsersCards({
  users,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
  onView,
}: UsersCardsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
      {users.map((user) => (
        <Card
          key={user.userId}
          className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[320px]"
        >
          <div className="flex-1 flex flex-col">
            <CardHeader className="p-0 pb-3">
              <div className="flex justify-between items-start w-full gap-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="font-semibold text-base">
                      {user.username?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">
                      {buildDisplayName(user)}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.role}
                    </p>
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
  );
}

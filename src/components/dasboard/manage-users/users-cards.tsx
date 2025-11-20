"use client";

import { Button } from "@/components/ui/button";
import { User } from "@/lib/validations/users";
import { Separator } from "@/components/ui/separator";
import { UsersActions } from "./users-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface UsersCardsProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UsersCards({ users, onEdit, onDelete }: UsersCardsProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100";
      case "manager":
        return "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100";
      case "supervisor":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100";
      case "clerk":
        return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100";
      case "employee":
      default:
        return "bg-muted text-foreground/70";
    }
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-2 sm:p-3">
      {users.map((user) => (
        <Card
          key={user.id}
          className="shadow-sm transition-shadow hover:shadow-md gap-0 py-0 h-full"
        >
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-start w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="font-medium">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate w-full leading-tight">
                    {user.username}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate leading-tight">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-end">
                <UsersActions
                  user={user}
                  onEdit={() => onEdit(user)}
                  onDelete={() => onDelete(user)}
                />
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="p-4 pt-3 sm:p-5 sm:pt-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="mr-2 text-foreground/80">Role:</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>

              {user.createdAt && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/90">Joined: </span>
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => onDelete(user)}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

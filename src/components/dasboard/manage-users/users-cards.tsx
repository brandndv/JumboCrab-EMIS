"use client";

import { Button } from "@/components/ui/button";
import { User } from "@/lib/validations/users";
import { UsersActions } from "./users-actions";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Mail, Calendar, Shield } from "lucide-react";

interface UsersCardsProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UsersCards({ users, onEdit, onDelete }: UsersCardsProps) {
  const getRoleVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "manager":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "supervisor":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "clerk":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "employee":
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between border-b border-border/60 pb-3">
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(user.username || user.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {user.username}
                </p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="mr-1 h-4 w-4 shrink-0" />
                  <span className="truncate">{user.email || "No email"}</span>
                </div>
              </div>
            </div>
            <UsersActions
              user={user}
              onEdit={() => onEdit(user)}
              onDelete={() => onDelete(user)}
            />
          </div>

          <div className="flex flex-1 flex-col justify-between gap-3 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className={getRoleVariant(user.role)}>
                {user.role.charAt(0).toUpperCase() +
                  user.role.slice(1).toLowerCase()}
              </Badge>
            </div>

            {user.createdAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onDelete(user)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

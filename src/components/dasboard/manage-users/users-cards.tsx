"use client";

import { Button } from "@/components/ui/button";
import { User } from "@/lib/validations/users";
import { Separator } from "@/components/ui/separator";
import { UsersActions } from "./users-actions";

interface UsersCardsProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UsersCards({ users, onEdit, onDelete }: UsersCardsProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "supervisor":
        return "bg-green-100 text-green-800";
      case "clerk":
        return "bg-yellow-100 text-yellow-800";
      case "employee":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {users.map((user) => (
        <div
          key={user.id}
          className="overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="font-medium text-gray-600">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{user.username}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <UsersActions
                user={user}
                onEdit={() => onEdit(user)}
                onDelete={() => onDelete(user)}
              />
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <span className="mr-2">Role:</span>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>

              {user.createdAt && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Joined: </span>
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(user)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDelete(user)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
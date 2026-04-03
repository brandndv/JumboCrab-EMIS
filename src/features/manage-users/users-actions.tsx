"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { UserWithEmployee } from "@/lib/validations/users";

interface UsersActionsProps {
  user: UserWithEmployee;
  onEdit: () => void;
  onDisable: () => void;
  onEnable?: () => void;
  onDelete?: () => void;
}

export function UsersActions({
  user,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
}: UsersActionsProps) {
  const isDisabled = !!user.isDisabled;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isDisabled ? (
          <>
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:bg-red-50 focus:text-red-700"
              onClick={onDisable}
            >
              Disable
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {onEnable && <DropdownMenuItem onClick={onEnable}>Enable</DropdownMenuItem>}
            {onDelete && (
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={onDelete}
              >
                Delete
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { CircleUserRound, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SignOutButton } from "@/components/ui/signout";
import { ThemeMenuSub } from "@/components/theme-provider/theme-menu-sub";
import Link from "next/link";

const getUserInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]?.charAt(0)?.toUpperCase() || "U";
  return `${parts[0]?.charAt(0) ?? ""}${
    parts[parts.length - 1]?.charAt(0) ?? ""
  }`.toUpperCase();
};

export function FooterSidebar({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar?: string | null;
    role: string | null;
  };
}) {
  const { isMobile } = useSidebar();
  const initials = getUserInitials(user.name || "User");
  const avatarSrc =
    typeof user.avatar === "string" && user.avatar.trim().length > 0
      ? user.avatar
      : undefined;

  return (
    <SidebarMenu>
      <SidebarMenuItem className="w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mx-auto transition-[width,height,padding,gap] duration-300 ease-out"
            >
              <div className="flex w-full items-center justify-start gap-3 transition-[gap] duration-300 ease-out group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                  <AvatarImage
                    src={avatarSrc}
                    alt={user.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid max-w-[12rem] flex-1 overflow-hidden text-left text-sm leading-tight opacity-100 transition-[max-width,opacity,transform] duration-300 ease-out group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={avatarSrc}
                    alt={user.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  href={user.role ? `/${user.role}/account` : "/sign-in"}
                  className="flex w-full items-center gap-2"
                >
                  <CircleUserRound />
                  My Account
                </Link>
              </DropdownMenuItem>
              <ThemeMenuSub />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <SignOutButton
                className="flex w-full items-center gap-2"
                as="button"
                unstyled
              >
                <LogOutIcon />
                Sign Out
              </SignOutButton>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

"use client";

import { useSession } from "@/hooks/use-session";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/ui/signout";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect } from "react";
import { ThemeMenuSub } from "@/components/theme-provider/theme-menu-sub";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppHeaderLoadingState } from "@/components/loading/loading-states";
import { CircleUserRound, LogOutIcon } from "lucide-react";

/**
 * NavHeader Component
 *
 * The main navigation header component that appears at the top of the application.
 * It includes:
 * - Breadcrumb navigation showing the current page hierarchy
 * - User session information
 * - Sidebar toggle button
 */
const NavHeader = () => {
  // Get user session data first
  const { user, employee, loading, error } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !error && !user) {
      router.replace("/sign-in");
    }
  }, [error, loading, router, user]);
  // Get current pathname and split it into segments for breadcrumb generation
  const pathname = usePathname();
  const segments = pathname
    .split("?")[0] // Remove query parameters
    .split("#")[0] // Remove hash fragments
    .split("/") // Split into path segments
    .filter(Boolean); // Remove empty segments

  // Show loading/error states if needed
  if (loading) return <AppHeaderLoadingState />;
  if (error)
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  if (!user) return null;

  /**
   * Converts a URL segment into a title case string
   * Example: "my-page" -> "My Page"
   */
  const toTitle = (s: string) =>
    s
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  /**
   * Converts a URL segment into a display-friendly label
   * Handles special cases like "new", "edit", "id" etc.
   */
  const toLabel = (s: string) => {
    const map: Record<string, string> = {
      new: "Create",
      edit: "Edit",
      id: "ID",
    };
    return map[s.toLowerCase()] ?? toTitle(s);
  };

  const displayName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : user.username;
  const accountHref = user.role ? `/${user.role}/account` : "/sign-in";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-full w-full items-center justify-between px-4">
        {/* Left side: Breadcrumb navigation */}
        <div className="flex items-center space-x-2">
          <SidebarTrigger className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground" />
          <Separator orientation="vertical" className="mx-2 h-6 bg-border" />

          <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
              {(() => {
                // Skip the first path segment (role like admin/employee)
                const role = segments[0];
                const rest = segments.slice(1);

                // If we're at the root or dashboard, just show "Dashboard"
                if (rest.length === 0) {
                  return (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-sm font-medium">
                        Dashboard
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  );
                }

                // Generate breadcrumb items for each path segment
                return rest.map((seg, idx) => {
                  const href = `/${[role, ...rest.slice(0, idx + 1)].join(
                    "/",
                  )}`;
                  const isLast = idx === rest.length - 1;
                  return (
                    <Fragment key={href}>
                      {/* Add separator between breadcrumb items */}
                      {idx > 0 && (
                        <BreadcrumbSeparator className="text-muted-foreground" />
                      )}
                      <BreadcrumbItem>
                        {!isLast ? (
                          // Show as non-clickable text for non-last items
                          <span className="text-sm font-medium text-muted-foreground">
                            {toLabel(seg)}
                          </span>
                        ) : (
                          // Last item remains as a clickable link
                          <BreadcrumbPage className="text-sm font-medium">
                            {toLabel(seg)}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                });
              })()}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right side: User info */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/60"
              >
                <div className="hidden flex-col items-end text-sm sm:flex">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {employee?.position}
                  </span>
                </div>
                <Avatar className="h-9 w-9">
                  {(user?.image || user?.employee?.img) && (
                    <AvatarImage
                      src={
                        (user?.image as string) ||
                        (user?.employee?.img as string)
                      }
                      alt={displayName}
                    />
                  )}
                  <AvatarFallback className="bg-primary/10 font-semibold uppercase text-primary">
                    {user ? (user.username?.[0] ?? "U") : "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-3 py-2 text-left">
                  <Avatar className="h-9 w-9">
                    {(user?.image || user?.employee?.img) && (
                      <AvatarImage
                        src={
                          (user?.image as string) ||
                          (user?.employee?.img as string)
                        }
                        alt={displayName}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 font-semibold uppercase text-primary">
                      {user ? (user.username?.[0] ?? "U") : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link
                    href={accountHref}
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
        </div>
      </div>
    </header>
  );
};

export default NavHeader;

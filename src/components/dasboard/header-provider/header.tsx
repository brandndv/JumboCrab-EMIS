"use client";

import { useSession } from "@/hooks/use-session";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import { usePathname } from "next/navigation";
import { Fragment, useEffect } from "react";
import { ModeToggle } from "@/components/theme-provider/mode-toggle";

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
  useEffect(() => {
    console.log("Current User:", user);
    console.log("Employee Data:", employee);
  }, [user, employee]);
  // Get current pathname and split it into segments for breadcrumb generation
  const pathname = usePathname();
  const segments = pathname
    .split("?")[0] // Remove query parameters
    .split("#")[0] // Remove hash fragments
    .split("/") // Split into path segments
    .filter(Boolean); // Remove empty segments

  // Show loading/error states if needed
  if (loading) return <div className="p-4">Loading user data...</div>;
  if (error)
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  if (!user)
    return <div className="p-4">Please log in to view this content</div>;

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
                    "/"
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
          <ModeToggle />
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-sm">
              <span className="font-medium">
                {employee
                  ? `${employee.firstName} ${employee.lastName}`
                  : user.username}
              </span>
              <span className="text-xs text-muted-foreground">{user.role}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">
                {user.username?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavHeader;

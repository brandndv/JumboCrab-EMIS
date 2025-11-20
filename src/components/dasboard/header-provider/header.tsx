"use client";

import { useSession } from "@/hooks/use-session";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
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
  // Get current pathname and split it into segments for breadcrumb generation
  const pathname = usePathname();
  const segments = pathname
    .split("?")[0]  // Remove query parameters
    .split("#")[0]  // Remove hash fragments
    .split("/")     // Split into path segments
    .filter(Boolean); // Remove empty segments

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

  // Get user session data
  const { session, loading, error } = useSession();

  // Show loading/error states if needed
  if (loading) return <div>Loading user data...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!session?.isLoggedIn)
    return <div>Please log in to view this content</div>;

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
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
                  const href = `/${[role, ...rest.slice(0, idx + 1)].join("/")}`;
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
                          </span>) : (
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
        <ModeToggle />
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-xs text-green-700">
            <span className="font-bold">Active Session</span>
            <span>Username: {session.username}</span>
            <span>Role: {session.role}</span>
          </div>
          {/* User avatar placeholder */}
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">U</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavHeader;

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
import { SignOutButton } from "@/components/ui/signout";
import { getSession } from "@/lib/auth";
import { Separator } from "@radix-ui/react-separator";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const NavHeader = () => {
  const pathname = usePathname();
  const segments = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);

  const toTitle = (s: string) =>
    s
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const toLabel = (s: string) => {
    const map: Record<string, string> = {
      new: "Create",
      edit: "Edit",
      id: "ID",
    };
    return map[s.toLowerCase()] ?? toTitle(s);
  };

  const { session, loading, error } = useSession();

  if (loading) return <div>Loading user data...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!session?.isLoggedIn)
    return <div>Please log in to view this content</div>;

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-full w-full items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          <SidebarTrigger className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground" />
          <Separator orientation="vertical" className="mx-2 h-6 bg-border" />

          <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
              {(() => {
                // Skip the first path segment (role like admin/employee)
                const role = segments[0];
                const rest = segments.slice(1);

                if (rest.length === 0) {
                  // At /{role} or /{role}/dashboard -> show Dashboard only
                  return (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-sm font-medium">
                        Dashboard
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  );
                }

                return rest.map((seg, idx) => {
                  const href = `/${[role, ...rest.slice(0, idx + 1)].join(
                    "/"
                  )}`;
                  const isLast = idx === rest.length - 1;
                  return (
                    <Fragment key={href}>
                      {idx > 0 && (
                        <BreadcrumbSeparator className="text-muted-foreground" />
                      )}
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-sm font-medium">
                            {toLabel(seg)}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            href={href}
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {toLabel(seg)}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                });
              })()}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col text-xs text-green-700">
            <span className="font-bold">Active Session</span>
            <span>Username: {session.username}</span>
            <span>Role: {session.role}</span>
          </div>
          {/* Add user profile/notifications here if needed */}
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">U</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavHeader;

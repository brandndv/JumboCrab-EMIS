"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useId, useState, useEffect, useRef } from "react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  ChevronRight,
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  BookMinus,
  HandCoins,
  ClipboardClock,
  Banknote,
  StickyNote,
  NotebookPen,
  Handshake,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavSidebarProps {
  userRole: string; // Use string (primitive) type, not String (object)
}

const NavSidebar = ({ userRole }: NavSidebarProps) => {
  const [mounted, setMounted] = useState(false);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const collapsibleId = useId(); // Generate a stable ID prefix

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateOpenState = (key: string, value: boolean) => {
    if (mounted) {
      // Only update state if we're not collapsed
      if (!isSidebarCollapsed) {
        // Close all other open items when opening a new one
        const newState = { ...openStates };
        if (value) {
          // Close all other items when opening a new one
          Object.keys(newState).forEach((k) => {
            if (k !== key) newState[k] = false;
          });
        }
        newState[key] = value;
        setOpenStates(newState);
      }
    }
  };

  // Close all submenus when sidebar is collapsed
  useEffect(() => {
    const handleResize = () => {
      if (sidebarRef.current) {
        const isCollapsed = sidebarRef.current.offsetWidth < 80; // Adjust this value based on your collapsed width
        setIsSidebarCollapsed(isCollapsed);
        if (isCollapsed) {
          setOpenStates({});
        }
      }
    };

    // Initial check
    handleResize();

    // Add resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }

    return () => {
      if (sidebarRef.current) {
        resizeObserver.unobserve(sidebarRef.current);
      }
    };
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      href: `/${userRole}/dashboard`,
      hasSubmenu: false,
      roles: [
        "admin",
        "generalManager",
        "manager",
        "supervisor",
        "clerk",
        "employee",
      ],
    },
    {
      id: "user",
      label: "User",
      icon: Users,
      href: `/${userRole}/users`,
      hasSubmenu:
        userRole === "admin" ||
        userRole === "generalManager" ||
        userRole === "manager",
      // Subitems: add per-subitem `roles` to control visibility (defaults aligned to parent)
      subItems: [
        {
          label: "Users Directory",
          path: "",
          roles: ["admin", "generalManager"],
        },
        {
          label: "Add User",
          path: "/create",
          roles: ["admin", "generalManager"],
        },
        { label: "Assign User", path: "", roles: ["admin", "generalManager"] },
      ],
      roles: ["admin", "generalManager"],
    },
    {
      id: "employees",
      label: "Employees",
      icon: Users,
      href: `/${userRole}/employees`,
      hasSubmenu: userRole === "admin" || userRole === "generalManager",
      // Subitems: add per-subitem roles (aligned with parent by default)
      subItems: [
        {
          label: "Employees Directory",
          path: "",
          roles: ["admin", "generalManager", "manager", "supervisor"],
        },
        {
          label: "Create User",
          path: "/new",
          roles: ["admin", "generalManager"],
        },
      ],
      roles: ["admin", "generalManager", "manager", "supervisor"],
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: ClipboardClock,
      href: `/${userRole}/attendance`,
      hasSubmenu: true,
      // Subitems: roles aligned with parent by default
      subItems: [
        {
          label: "Dashboard",
          path: "",
          roles: [
            "admin",
            "generalManager",
            "manager",
            "supervisor",
            "clerk",
            "employee",
          ],
        },
        {
          label: "Mark Attendance",
          path: "/mark",
          roles: [
            "admin",
            "generalManager",
            "manager",
            "supervisor",
            "clerk",
            "employee",
          ],
        },
        {
          label: "View Records",
          path: "/records",
          roles: [
            "admin",
            "generalManager",
            "manager",
            "supervisor",
            "clerk",
            "employee",
          ],
        },
        {
          label: "Reports",
          path: "/reports",
          roles: [
            "admin",
            "generalManager",
            "manager",
            "supervisor",
            "clerk",
            "employee",
          ],
        },
        {
          label: "Settings",
          path: "/settings",
          roles: [
            "admin",
            "generalManager",
            "manager",
            "supervisor",
            "clerk",
            "employee",
          ],
        },
      ],
      roles: [
        "admin",
        "generalManager",
        "manager",
        "supervisor",
        "clerk",
        "employee",
      ],
    },
    {
      id: "schedule",
      label: "Schedule",
      icon: Clock,
      href: `/${userRole}/schedule`,
      hasSubmenu: true,
      subItems: [
        {
          label: "View Schedule",
          path: "",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Create Shift",
          path: "/create",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Assign Shifts",
          path: "/assign",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Time Off Requests",
          path: "/time-off",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Calendar View",
          path: "/calendar",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
      ],
      roles: ["admin", "manager", "supervisor", "clerk", "employee"],
    },
    {
      id: "deduction",
      label: "Deduction",
      icon: BookMinus,
      href: `/${userRole}/deduction`,
      hasSubmenu: true,
      subItems: [
        {
          label: "Overview",
          path: "",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Add Deduction",
          path: "/add",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Deduction Types",
          path: "/types",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Reports",
          path: "/reports",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "History",
          path: "/history",
          roles: ["admin", "generalManager", "clerk"],
        },
      ],
      roles: ["admin", "generalManager", "clerk"],
    },
    {
      id: "contribution",
      label: "Contribution",
      icon: HandCoins,
      href: `/${userRole}/contribution`,
      hasSubmenu: true,
      subItems: [
        {
          label: "Overview",
          path: "",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Add Contribution",
          path: "/add",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Contribution Plans",
          path: "/plans",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "Statements",
          path: "/statements",
          roles: ["admin", "generalManager", "clerk"],
        },
        {
          label: "History",
          path: "/history",
          roles: ["admin", "generalManager", "clerk"],
        },
      ],
      roles: ["admin", "generalManager", "clerk"],
    },
    {
      id: "payroll",
      label: "Payroll",
      icon: Banknote,
      href: `/${userRole}/payroll`,
      hasSubmenu: true,
      subItems: [
        {
          label: "Dashboard",
          path: "",
          roles: ["admin", "generalManager", "clerk", "employee"],
        },
        {
          label: "Process Payroll",
          path: "/process",
          roles: ["admin", "generalManager", "clerk", "employee"],
        },
        {
          label: "Payslips",
          path: "/payslips",
          roles: ["admin", "generalManager", "clerk", "employee"],
        },
        {
          label: "Tax Settings",
          path: "/tax",
          roles: ["admin", "generalManager", "clerk", "employee"],
        },
        {
          label: "Reports",
          path: "/reports",
          roles: ["admin", "generalManager", "clerk", "employee"],
        },
      ],
      roles: ["admin", "generalManager", "clerk", "employee"],
    },
    {
      id: "memo",
      label: "Memo",
      icon: StickyNote,
      href: `/${userRole}/memo`,
      hasSubmenu: true,
      subItems: [
        {
          label: "Inbox",
          path: "",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Compose",
          path: "/compose",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Sent",
          path: "/sent",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Drafts",
          path: "/drafts",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
        {
          label: "Templates",
          path: "/templates",
          roles: ["admin", "manager", "supervisor", "clerk", "employee"],
        },
      ],
      roles: ["admin", "manager", "supervisor", "clerk", "employee"],
    },
    {
      id: "requests",
      label: "Requests",
      icon: Handshake,
      href: `/${userRole}/requests`,
      hasSubmenu: true,
      subItems: [
        {
          label: "All Requests",
          path: "",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "History",
          path: "/history",
          roles: ["admin", "manager", "employee"],
        },
      ],
      roles: ["admin", "manager", "employee"],
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      href: `/${userRole}/reports`,
      hasSubmenu: true,
      subItems: [
        {
          label: "Overview",
          path: "",
          roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
        },
        {
          label: "Employee Reports",
          path: "/employees",
          roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
        },
        {
          label: "Attendance Reports",
          path: "/attendance",
          roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
        },
        {
          label: "Payroll Reports",
          path: "/payroll",
          roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
        },
        {
          label: "Custom Reports",
          path: "/custom",
          roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
        },
      ],
      roles: ["admin", "generalManager", "manager", "supervisor", "clerk"],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(userRole || "admin")
  );
  return (
    <div
      ref={sidebarRef}
      className="flex flex-col items-center space-y-2 w-full"
    >
      <SidebarGroup className="w-full">
        <SidebarMenu className="space-y-1 w-full max-w-xs mx-auto">
          {filteredMenuItems.map((item) => {
            const active = isActive(item.href);
            // Subitem role gating: only show subitems whose optional 'roles' includes current userRole.
            // To configure, add `roles: ["admin","manager"]` on any subitem object in `menuItems` above.
            const visibleSubItems = (item.subItems?.filter((si: any) =>
              typeof si === "object"
                ? !("roles" in si) || si.roles?.includes(userRole)
                : true
            ) || []) as any[];

            if (item.hasSubmenu) {
              return (
                <Collapsible
                  key={item.id}
                  open={!isSidebarCollapsed && (openStates[item.id] || false)}
                  onOpenChange={(value: boolean) =>
                    !isSidebarCollapsed && updateOpenState(item.id, value)
                  }
                  data-collapsible-id={`${collapsibleId}-${item.id}`}
                >
                  <SidebarMenuItem className="group">
                    {/*
                      Inactive hover colors:
                      - Background: hover:bg-orange-100 (light)
                      - Dark mode bg: dark:hover:bg-orange-900/30
                      - Text color: hover:text-orange-600
                      Change these three to customize inactive hover.

                      Active colors (no hover change):
                      - Background: bg-orange-600
                      - Text: text-white
                      Edit these to customize active appearance.
                    */}
                    {/*
                      Row padding: tweak collapsed vs expanded paddings here
                      - Expanded: px-3 py-2
                      - Collapsed: px-0 to keep icon perfectly centered
                    */}
                    <div
                      className={`flex items-center w-full rounded-lg transition-colors ${
                        isSidebarCollapsed ? "p-0" : "px-3 py-2"
                      } ${
                        pathname.startsWith(item.href) &&
                        (pathname === item.href ||
                          pathname[item.href.length] === "/")
                          ? "bg-orange-600 text-white hover:bg-orange-600 hover:text-white"
                          : "text-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600"
                      }`}
                    >
                      <SidebarMenuButton
                        asChild
                        // Tooltip colors: change bg/text/arrow here
                        tooltip={{
                          children: item.label,
                          className:
                            "!bg-orange-600 !text-white border-orange-500 shadow-lg",
                          arrowClassName: "bg-orange-600 fill-orange-600",
                        }}
                        // Collapsed: make the action square and icon slightly bigger
                        className={`w-full hover:bg-transparent focus-visible:ring-0 text-inherit hover:text-inherit ${
                          isSidebarCollapsed
                            ? "flex justify-center group-data-[collapsible=icon]:size-10! [&>svg]:h-5 [&>svg]:w-5"
                            : "text-left [&>svg]:h-4 [&>svg]:w-4"
                        }`}
                      >
                        <Link
                          href={item.href}
                          className={`${
                            isSidebarCollapsed
                              ? "flex w-full justify-center"
                              : "block w-full"
                          }`}
                          onClick={(e) => {
                            // Prevent navigation and toggle submenu only if user has any visible subitems
                            if (
                              !isSidebarCollapsed &&
                              visibleSubItems.length > 0
                            ) {
                              e.preventDefault();
                              updateOpenState(item.id, !openStates[item.id]);
                            }
                          }}
                        >
                          {/* Icon + label spacing: adjust gap here */}
                          <div
                            className={`flex items-center ${
                              isSidebarCollapsed
                                ? "justify-center"
                                : "justify-start"
                            } ${isSidebarCollapsed ? "gap-0" : "gap-3"} w-full`}
                          >
                            {/* Main icon size: change h-4 w-4 here */}
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!isSidebarCollapsed && (
                              <span className="font-medium">{item.label}</span>
                            )}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                      {!isSidebarCollapsed && visibleSubItems.length > 0 && (
                        <>
                          {/*
                              Chevron inherits parent colors; keep background transparent to avoid separate hover bg
                              Chevron touch target + size: adjust p-* and h/w here
                            */}
                          <button
                            className={`p-2 rounded-md transition-colors bg-transparent hover:bg-transparent ${
                              pathname.startsWith(item.href) &&
                              (pathname === item.href ||
                                pathname[item.href.length] === "/")
                                ? "text-white hover:text-white"
                                : "text-inherit hover:text-inherit"
                            }`}
                            onClick={(
                              e: React.MouseEvent<HTMLButtonElement>
                            ) => {
                              e.stopPropagation();
                              updateOpenState(item.id, !openStates[item.id]);
                            }}
                          >
                            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                          </button>
                        </>
                      )}
                    </div>
                    <CollapsibleContent className="mt-1">
                      {/* Submenu spacing: adjust ml-* and space-y-* to make open section smaller */}
                      <SidebarMenuSub className="space-y-0.5 ml-4">
                        {visibleSubItems.map((subItem) => {
                          const isObject = typeof subItem === "object";
                          const label = isObject ? subItem.label : subItem;
                          const path = isObject ? subItem.path : `/${subItem}`;
                          const subHref = `${item.href}${path}`;
                          // Only highlight if the current path exactly matches the subitem's href
                          // or if it's the base path and the current path matches exactly
                          const subActive =
                            pathname === subHref ||
                            (path === "" && pathname === item.href);

                          return (
                            <SidebarMenuSubItem
                              key={isObject ? subItem.label : subItem}
                            >
                              <SidebarMenuSubButton
                                asChild
                                className={`pl-4 w-full text-left transition-colors ${
                                  subActive
                                    ? "text-orange-600 font-medium dark:text-orange-400"
                                    : "text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400"
                                }`}
                              >
                                <Link href={subHref}>{label}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            } else {
              return (
                <SidebarMenuItem key={item.id} className="group">
                  <div
                    className={`flex items-center w-full rounded-lg transition-colors ${
                      isSidebarCollapsed ? "p-0" : "px-3 py-2"
                    } ${
                      pathname.startsWith(item.href) &&
                      (pathname === item.href || pathname[item.href.length] === "/")
                        ? "bg-orange-600 text-white hover:bg-orange-600 hover:text-white"
                        : "text-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600"
                    }`}
                  >
                    <SidebarMenuButton
                      asChild
                      tooltip={{
                        children: item.label,
                        className: "!bg-orange-600 !text-white border-orange-500 shadow-lg",
                        arrowClassName: "bg-orange-600 fill-orange-600",
                      }}
                      className={`w-full hover:bg-transparent focus-visible:ring-0 text-inherit hover:text-inherit ${
                        isSidebarCollapsed
                          ? "flex justify-center group-data-[collapsible=icon]:size-10! [&>svg]:h-5 [&>svg]:w-5"
                          : "text-left [&>svg]:h-4 [&>svg]:w-4"
                      }`}
                    >
                      <Link
                        href={item.href}
                        className={`${
                          isSidebarCollapsed ? "flex w-full justify-center" : "block w-full"
                        }`}
                      >
                        <div
                          className={`flex items-center ${
                            isSidebarCollapsed ? "justify-center" : "justify-start"
                          } ${isSidebarCollapsed ? "gap-0" : "gap-3"} w-full`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!isSidebarCollapsed && (
                            <span className="font-medium">{item.label}</span>
                          )}
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </div>
                </SidebarMenuItem>
              );
            }
          })}
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
};

export default NavSidebar;

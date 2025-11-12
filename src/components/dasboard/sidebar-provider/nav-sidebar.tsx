"use client";

import { usePathname } from "next/navigation";
import { useId, useState, useEffect } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
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
  userRole?: string;
}

const NavSidebar = ({ userRole }: NavSidebarProps) => {
  const [mounted, setMounted] = useState(false);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const collapsibleId = useId(); // Generate a stable ID prefix

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateOpenState = (key: string, value: boolean) => {
    if (mounted) {
      setOpenStates((prev) => ({ ...prev, [key]: value }));
    }
  };

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
        "general-manager",
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
      hasSubmenu: false,
      subItems: ["Add user", "Update user"],
      roles: ["admin", "general-manager"],
    },
    {
      id: "employees",
      label: "Employees",
      icon: Users,
      href: `/${userRole}/employees`,
      hasSubmenu: false,
      subItems: ["Add employee", "Update employee"],
      roles: ["admin", "general-manager"],
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: ClipboardClock,
      href: "/attendance",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: [
        "admin",
        "general-manager",
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
      href: "/schedule",
      hasSubmenu: false,
      subItems: ["Create", "Manage"],
      roles: ["admin", "manager", "supervisor", "clerk", "employee"],
    },
    {
      id: "deduction",
      label: "Deduction",
      icon: BookMinus,
      href: "/deduction",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: ["admin", "general-manager", "clerk"],
    },
    {
      id: "contribution",
      label: "Contribution",
      icon: HandCoins,
      href: "/contribution",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: ["admin", "general-manager", "clerk"],
    },
    {
      id: "payroll",
      label: "Payroll",
      icon: Banknote,
      href: "/payroll",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: ["admin", "general-manager", "clerk", "employee"],
    },
    {
      id: "memo",
      label: "Memo",
      icon: StickyNote,
      href: "/memo",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: ["admin", "manager", "supervisor", "clerk", "employee"],
    },
    {
      id: "evaluation",
      label: "Evaluation",
      icon: NotebookPen,
      href: "/evaluation",
      hasSubmenu: true,
      subItems: ["Create", "Manage"],
      roles: ["admin", "supervisor"],
    },
    {
      id: "requests",
      label: "Requests",
      icon: Handshake,
      href: "/requests",
      hasSubmenu: false,
      roles: ["admin", "manager", "employee"],
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
      href: "/reports",
      hasSubmenu: false,
      roles: ["admin", "general-manager", "manager", "supervisor", "clerk"],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(userRole || "admin")
  );
  return (
    <SidebarGroup className="flex flex-col items-center space-y-2">
      <SidebarMenu className="space-y-1 w-full max-w-xs mx-auto">
        {filteredMenuItems.map((item) => {
          const active = isActive(item.href);

          if (item.hasSubmenu) {
            return (
              <Collapsible
                key={item.id}
                open={openStates[item.id] || false}
                onOpenChange={(value: boolean) =>
                  updateOpenState(item.id, value)
                }
                data-collapsible-id={`${collapsibleId}-${item.id}`}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger
                    asChild
                    data-collapsible-id={`${collapsibleId}-${item.id}-trigger`}
                  >
                    <SidebarMenuButton
                      tooltip={{
                        children: item.label,
                        className:
                          "bg-orange-600 text-white border-orange-500 shadow-lg",
                      }}
                      className="collapsible-menu-button rounded-lg transition-colors hover:bg-orange-600 hover:text-white"
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.label}</span>
                      </span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1">
                    <SidebarMenuSub className="space-y-1 ml-6">
                      {item.subItems?.map((subItem) => {
                        const subHref = `${item.href}/${subItem
                          .toLowerCase()
                          .replace(" ", "-")}`;
                        const subActive = isActive(subHref);

                        return (
                          <SidebarMenuSubItem key={subItem}>
                            <SidebarMenuSubButton
                              asChild
                              className={`rounded-md transition-colors ${
                                subActive
                                  ? "bg-orange-600 text-white"
                                  : "hover:bg-orange-500 hover:text-white"
                              }`}
                            >
                              <a href={subHref}>{subItem}</a>
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
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  tooltip={{
                    children: item.label,
                    className:
                      "bg-orange-600 text-white border-orange-500 shadow-lg",
                  }}
                  asChild
                  className={`rounded-lg transition-colors ${
                    active
                      ? "bg-orange-600 text-white"
                      : "hover:bg-orange-500 hover:text-white"
                  }`}
                >
                  <a href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
};

export default NavSidebar;

"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import HeaderSidebar from "./header-sidebar";

import { FooterSidebar } from "./footer-sidebar";
import NavSidebar from "./nav-sidebar";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";

const AppSidebar = () => {
  const { role, isLoading } = useRole();
  const { employee, user } = useSession();

  if (isLoading) {
    return <div>Loading sidebar...</div>;
  }
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <HeaderSidebar />
      </SidebarHeader>
      <SidebarContent>{role && <NavSidebar userRole={role} />}</SidebarContent>
      <SidebarFooter>
        {/* <FooterSidebar
          user={{
            name: "John Doe",
            email: "john.doe@example.com",
            avatar:
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=880",
          }}
        /> */}
        <FooterSidebar
          user={{
            name: employee
              ? `${employee.firstName} ${employee.lastName || ""}`.trim()
              : user?.username
              ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
              : "User",
            email: user?.email || "",
            avatar: "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;

"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import HeaderSidebar from "./header-sidebar";
import NavSidebar from "./nav-sidebar";
import { FooterSidebar } from "./footer-sidebar";

const AppSidebar = ({ userRole = "admin" }: { userRole?: string }) => {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <HeaderSidebar />
      </SidebarHeader>
      <SidebarContent>
        <NavSidebar userRole={userRole} />
      </SidebarContent>
      <SidebarFooter>
        <FooterSidebar
          user={{
            name: "John Doe",
            email: "john.doe@example.com",
            avatar:
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=880",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;

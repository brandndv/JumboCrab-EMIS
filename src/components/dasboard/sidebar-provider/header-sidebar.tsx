"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const HeaderSidebar = () => {
  return (
    <SidebarMenu className="data-state-collapsed:justify-center my-4">
      <SidebarMenuItem className="data-state-collapsed:justify-center">
        <SidebarMenuButton
          size="lg"
          className=""
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage
              src={"/logo.png"}
              alt="Logo"
              className="object-contain"
            />
            <AvatarFallback className="rounded-lg">Logo</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">JumboCrab EMIS</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default HeaderSidebar;

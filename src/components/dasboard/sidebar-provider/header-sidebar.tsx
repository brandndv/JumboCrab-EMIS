"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const HeaderSidebar = () => {
  return (
    // Center logo when collapsed; tweak spacing in className below
    <SidebarMenu className="my-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:justify-center">
        {/* Center button when collapsed */}
        <SidebarMenuButton
          size="lg"
          className="justify-start group-data-[collapsible=icon]:justify-center"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage
              src={"/logo.png"}
              alt="Logo"
              className="object-contain"
            />
            <AvatarFallback className="rounded-lg">Logo</AvatarFallback>
          </Avatar>
          {/* Hide text when collapsed; edit to change behavior */}
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">JumboCrab EMIS</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default HeaderSidebar;

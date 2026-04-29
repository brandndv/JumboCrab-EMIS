"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Image from "next/image";

const HeaderSidebar = () => {
  return (
    <SidebarMenu className="my-4">
      <SidebarMenuItem className="w-full">
        <SidebarMenuButton
          size="lg"
          className="mx-auto transition-[width,height,padding,gap] duration-300 ease-out"
        >
          <div className="flex w-full items-center justify-start gap-3 transition-[gap] duration-300 ease-out group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/logo-icon.png"
                alt="Logo"
                fill
                sizes="32px"
                className="object-contain object-center"
                priority
              />
            </div>
            <div className="grid max-w-[12rem] flex-1 overflow-hidden text-left text-sm leading-tight opacity-100 transition-[max-width,opacity,transform] duration-300 ease-out group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0">
              <span className="truncate text-[1.05rem] font-semibold tracking-tight">
                JumboCrab EMIS
              </span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default HeaderSidebar;

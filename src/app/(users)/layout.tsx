import NavHeader from "@/components/dasboard/header-provider/header";
import AppSidebar from "@/components/dasboard/sidebar-provider/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <SidebarProvider className="h-full w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <NavHeader />
          <div className="min-h-0 w-full flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

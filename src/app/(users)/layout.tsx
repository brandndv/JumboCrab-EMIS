import NavHeader from "@/components/dasboard/header-provider/header";
import AppSidebar from "@/components/dasboard/sidebar-provider/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <NavHeader />
          <SidebarInset className="flex-1 overflow-auto">
            <div className="h-full w-full">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

import { SessionProvider } from "@/components/providers/session-provider";
import NavHeader from "@/features/header-provider/header";
import AppSidebar from "@/features/sidebar-provider/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { getCurrentPlainSession } from "@/lib/current-session";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSession = await getCurrentPlainSession();

  if (!initialSession?.isLoggedIn) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <SessionProvider initialSession={initialSession}>
        <SidebarProvider className="h-full w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <NavHeader />
            <div className="min-h-0 w-full flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </SessionProvider>
    </div>
  );
}

import RoleDashboardPage from "@/features/dashboard/role-dashboard-page";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return <RoleDashboardPage role="admin" />;
}

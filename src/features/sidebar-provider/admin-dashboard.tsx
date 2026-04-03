"use client";
import { useRole } from "@/hooks/use-role";
import { InlineLoadingState } from "@/components/loading/loading-states";
const AdminDashboardPage = () => {
  const { role, isLoading } = useRole();
  if (isLoading) return <InlineLoadingState label="Loading dashboard" />;
  if (!role) return <div>Not Authorized</div>;
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <h1>Your role is: {role}</h1>
    </div>
  );
};

export default AdminDashboardPage;

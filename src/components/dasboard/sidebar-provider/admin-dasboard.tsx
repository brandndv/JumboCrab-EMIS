import { getUserRole } from "@/lib/auth";
import React from "react";

const AdminDashboardPage = () => {
  const role = getUserRole();
  return (
    <>
      <h1>AdminDashboardPage</h1>
      <h1>role</h1>
    </>
  );
};

export default AdminDashboardPage;

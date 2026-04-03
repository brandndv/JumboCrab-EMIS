"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CreateUserForm from "@/features/manage-users/users-create-form";

function ManagerUserCreateContent() {
  const searchParams = useSearchParams();
  const defaultEmployeeId = searchParams.get("employeeId") || undefined;

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <CreateUserForm defaultEmployeeId={defaultEmployeeId} />
    </div>
  );
}

export default function ManagerUserCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading...</div>
      }
    >
      <ManagerUserCreateContent />
    </Suspense>
  );
}

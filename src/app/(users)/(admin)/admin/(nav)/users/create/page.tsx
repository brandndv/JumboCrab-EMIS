"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import CreateUserForm from "@/components/dasboard/manage-users/users-create-form";

export default function AdminUserCreatePage({
  searchParams,
}: {
  searchParams?: { employeeId?: string } | Promise<{ employeeId?: string }>;
}) {
  const [defaultEmployeeId, setDefaultEmployeeId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await Promise.resolve(searchParams);
      setDefaultEmployeeId(resolved?.employeeId);
    };
    resolveParams();
  }, [searchParams]);

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-primary/5 via-background to-background p-6 shadow-sm mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Accounts
        </p>
        <h1 className="text-3xl font-bold text-foreground mt-1">
          Create New User
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Add a user account. If launched from an unassigned employee, we preselect them for you.
        </p>
      </div>

      <Card className="p-6 border border-border/70 shadow-sm">
        <CreateUserForm defaultEmployeeId={defaultEmployeeId} />
      </Card>
    </div>
  );
}

"use client";

import { ModuleLoadingState } from "@/components/loading/loading-states";

export function UsersLoadingState() {
  return (
    <ModuleLoadingState
      title="Users"
      description="Pulling account roles, employee links, and status groups."
    />
  );
}

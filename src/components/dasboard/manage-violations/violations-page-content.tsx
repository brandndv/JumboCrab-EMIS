"use client";
import { useViolations } from "@/hooks/use-violations";
import ViolationsTable from "./violations-table";
import { Card } from "@/components/ui/card";

const ViolationsPageContent = () => {
  const {
    violations,
    setViolations,
    filteredViolations,
    loading,
    refreshViolations,
    error,
    searchTerm,
    setSearchTerm,
    violationType,
    setViolationType,
    statusFilter,
    setStatusFilter,
  } = useViolations();
  return (
    <Card className="px-4 py-8 sm:px-6 lg:px-12 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Violations</h1>
          <p className="text-muted-foreground text-sm">
            Manage violation records
          </p>
        </div>
      </div>
      <div>
        <ViolationsTable />
      </div>
    </Card>
  );
};

export default ViolationsPageContent;

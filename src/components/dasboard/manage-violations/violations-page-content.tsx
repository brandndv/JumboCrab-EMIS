"use client";

import ViolationsTable from "./violations-table";

const ViolationsPageContent = () => {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Violations</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage violation definitions for assignment.
        </p>
      </div>
      <div className="grid gap-6">
        <ViolationsTable />
      </div>
    </div>
  );
};

export default ViolationsPageContent;

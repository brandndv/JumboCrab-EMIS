"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEmployees } from "@/features/manage-employees/employees-provider";
import {
  DynamicBlockLoadingState,
  ModuleLoadingState,
} from "@/components/loading/loading-states";

const EmployeesCard = dynamic(
  () => import("@/features/manage-employees/employees-cards"),
  {
    ssr: false,
    loading: () => <DynamicBlockLoadingState label="Loading employee cards" />,
  },
);

const EmployeeComboBox = dynamic(
  () =>
    import("@/features/manage-employees/employee-combo/employee-combobox"),
  {
    ssr: false,
    loading: () => (
      <DynamicBlockLoadingState
        label="Loading employee filters"
        className="min-h-[120px]"
      />
    ),
  },
);

function ResetFiltersButton() {
  const { setSearchTerm, setSelectedDepartment, setSelectedStatus } =
    useEmployees();

  return (
    <Button
      variant="outline"
      onClick={() => {
        setSearchTerm("");
        setSelectedDepartment(null);
        setSelectedStatus(null);
      }}
    >
      <RotateCcw className="mr-2 h-4 w-4" />
      Reset filters
    </Button>
  );
}

export default function EmployeesPageContent() {
  const { filteredEmployees, loading, error, showArchived, setShowArchived } =
    useEmployees();
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.replace(/\/$/, "");

  if (loading) {
    return (
      <ModuleLoadingState
        title="Employees"
        description="Loading employee records, filters, and archive state."
        cardCount={4}
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive shadow-sm">
        <div className="flex items-start space-x-3">
          <svg
            className="h-5 w-5 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your employee&apos;s records
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
            className="w-full sm:w-auto"
          >
            {showArchived ? "Hide Archived" : "View Archived"}
          </Button>
          <Button
            onClick={() => router.push(`${basePath}/new`)}
            className="w-full sm:w-auto"
            disabled={showArchived}
          >
            Add New Employee
          </Button>
        </div>
      </div>

      <div className="mt-6 bg-card text-card-foreground border border-border shadow-sm rounded-xl p-5">
        <div className="mb-6">
          <EmployeeComboBox />
        </div>
        <div className="overflow-x-auto">
          {filteredEmployees.length > 0 ? (
            <EmployeesCard employees={filteredEmployees} />
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-muted-foreground opacity-40 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  height="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground">
                No employees found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
              <div className="mt-6">
                <ResetFiltersButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

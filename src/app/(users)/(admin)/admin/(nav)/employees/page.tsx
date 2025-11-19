"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  EmployeesProvider,
  useEmployees,
} from "@/components/dasboard/manage-empoyees/employees-provider";
import dynamic from "next/dynamic";

// Dynamically import the EmployeesTable component with SSR disabled
const EmployeesTable = dynamic(
  () => import("@/components/dasboard/manage-empoyees/employees-cards"),
  { ssr: false, loading: () => <div>Loading table...</div> }
);

// Dynamically import the EmployeeComboBox component with SSR disabled
const EmployeeComboBox = dynamic(
  () =>
    import(
      "@/components/dasboard/manage-empoyees/employee-combo/employee-combobox"
    ),
  { ssr: false, loading: () => <div>Loading filters...</div> }
);

function ResetFiltersButton() {
  const { 
    setSearchTerm, 
    setSelectedDepartment, 
    setSelectedStatus 
  } = useEmployees();

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

function EmployeesContent() {
  const { filteredEmployees, loading, error } = useEmployees();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-10 px-5 md:px-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your employee's records
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/employees/new")}
          className="w-full md:w-auto"
        >
          Add New Employee
        </Button>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg p-4">
        <div className="mb-6">
          <EmployeeComboBox />
        </div>
        <div className="overflow-x-auto">
          {filteredEmployees.length > 0 ? (
            <EmployeesTable employees={filteredEmployees} />
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
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
              <h3 className="text-lg font-medium text-gray-900">No employees found</h3>
              <p className="mt-1 text-sm text-gray-500">
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

export default function EmployeesPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <EmployeesProvider>
        <EmployeesContent />
      </EmployeesProvider>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getEmployees } from "@/actions/employees-action";
import { Employee, validateEmployee } from "@/lib/validations/employees";

type EmployeeContextType = {
  employees: Employee[];
  filteredEmployees: Employee[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedDepartment: string | null;
  setSelectedDepartment: (dept: string | null) => void;
  selectedStatus: string | null;
  setSelectedStatus: (status: string | null) => void;
  departments: string[];
  refreshEmployees: () => Promise<void>;
};

const EmployeesContext = createContext<EmployeeContextType | undefined>(
  undefined
);

export function EmployeesProvider({ children }: { children: React.ReactNode }) {
  // State declarations at the top level (no conditional hooks)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([
    "KITCHEN",
    "DINING",
  ]); // Default departments

  const fetchEmployeesData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching employees...");
      const response = await getEmployees();

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch employees");
      }

      // Validate each employee
      const validatedEmployees: Employee[] = [];
      for (const emp of response.data) {
        const result = validateEmployee(emp);
        if (result.success) {
          validatedEmployees.push(result.data);
        } else {
          console.error("Invalid employee data:", result.error);
        }
      }

      setEmployees(validatedEmployees);
      // Extract unique departments from employees
      const uniqueDepartments = Array.from(
        new Set(validatedEmployees.map((emp) => emp.department).filter(Boolean))
      ) as string[];
      setDepartments((prev) => [...new Set([...prev, ...uniqueDepartments])]);
      console.log(`Successfully loaded ${validatedEmployees.length} employees`);
    } catch (err) {
      console.error("Error in fetchEmployeesData:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch employees"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  // Loading and error states moved to the render part, not before hooks

  // Apply filters and search
  useEffect(() => {
    let result = [...employees];

    // Apply department filter
    if (selectedDepartment) {
      result = result.filter((emp) => emp.department === selectedDepartment);
    }

    // Apply status filter
    if (selectedStatus) {
      result = result.filter((emp) => emp.currentStatus === selectedStatus);
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.firstName?.toLowerCase().includes(term) ||
          emp.lastName?.toLowerCase().includes(term) ||
          emp.employeeCode?.toLowerCase().includes(term) ||
          emp.email?.toLowerCase().includes(term)
      );
    }

    setFilteredEmployees(result);
  }, [employees, selectedDepartment, selectedStatus, searchTerm]);

  // Provide the context value
  const contextValue = {
    employees, // The full list of employees
    filteredEmployees, // The filtered list of employees
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectedDepartment,
    setSelectedDepartment,
    selectedStatus,
    setSelectedStatus,
    departments,
    refreshEmployees: fetchEmployeesData,
  };

  return (
    <EmployeesContext.Provider value={contextValue}>
      {children}
    </EmployeesContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeesContext);
  if (context === undefined) {
    throw new Error("useEmployees must be used within an EmployeesProvider");
  }
  return context;
}
export default EmployeesProvider;

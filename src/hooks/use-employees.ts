"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getEmployees } from "@/actions/employees/employees-action";
import { Employee, validateEmployee } from "@/lib/validations/employees";

export function useEmployeesState() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const fetchEmployeesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getEmployees();

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch employees");
      }

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

      const uniqueDepartments = Array.from(
        new Set(validatedEmployees.map((emp) => emp.department).filter(Boolean))
      ) as string[];
      setDepartments(uniqueDepartments);
    } catch (err) {
      console.error("Error in fetchEmployeesData:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch employees"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployeesData();
  }, [fetchEmployeesData]);

  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (selectedDepartment) {
      result = result.filter((emp) => emp.department === selectedDepartment);
    }

    if (selectedStatus) {
      result = result.filter((emp) => emp.currentStatus === selectedStatus);
    }

    result = result.filter((emp) =>
      showArchived ? Boolean(emp.isArchived) : !emp.isArchived
    );

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

    return result;
  }, [employees, selectedDepartment, selectedStatus, searchTerm, showArchived]);

  return {
    employees,
    filteredEmployees,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectedDepartment,
    setSelectedDepartment,
    selectedStatus,
    setSelectedStatus,
    departments,
    showArchived,
    setShowArchived,
    refreshEmployees: fetchEmployeesData,
  };
}

export type EmployeesState = ReturnType<typeof useEmployeesState>;

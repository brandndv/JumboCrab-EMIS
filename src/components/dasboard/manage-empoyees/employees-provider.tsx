"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getEmployees } from "@/actions/employees-action";
import { Employee, validateEmployee } from "@/lib/validations/employees";
import EmployeesTable from "./employees-table";
import EmployeeSearch from "./employee-combo/employee-search";
import EmployeeComboBox from "./employee-combo/employee-combobox";

type EmployeeContextType = {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  refreshEmployees: () => Promise<void>;
};

const EmployeesContext = createContext<EmployeeContextType | undefined>(
  undefined
);

export function EmployeesProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <div>Loading employees...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <EmployeesContext.Provider
      value={{
        employees,
        loading,
        error,
        refreshEmployees: fetchEmployeesData,
      }}
    >
      <div></div>
      <h1 className="text-2xl font-bold mb-2">Employees</h1>
      <p className="text-muted-foreground mb-5">
        Manage your employee's records
      </p>
      <div className="mt-5">
        <div className="mb-5">
          <EmployeeComboBox />
        </div>
        <EmployeesTable employees={employees} />
      </div>
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

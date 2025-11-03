"use client";

import {
  EmployeesProvider,
  useEmployees,
} from "@/components/dasboard/manage-empoyees/employees-provider";
import EmployeesTable from "@/components/dasboard/manage-empoyees/employees-table";
import EmployeeComboBox from "@/components/dasboard/manage-empoyees/employee-combo/employee-combobox";

function EmployeesContent() {
  const { loading, error, filteredEmployees } = useEmployees();

  if (loading) {
    return <div className="p-4">Loading employees...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-2">Employees</h1>
      <p className="text-muted-foreground mb-5">
        Manage your employee's records
      </p>
      <div className="mt-5">
        <div className="mb-5">
          <EmployeeComboBox />
        </div>
        <EmployeesTable employees={filteredEmployees} />
      </div>
    </div>
  );
}

const EmployeesPage = () => {
  return (
    <div className="px-20 py-10">
      <EmployeesProvider>
        <EmployeesContent />
      </EmployeesProvider>
    </div>
  );
};

export default EmployeesPage;

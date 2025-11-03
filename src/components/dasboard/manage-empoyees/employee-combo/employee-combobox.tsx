import { Button } from "@/components/ui/button";
import { useState } from "react";
import EmployeeSearch from "./employee-search";
import EmployeeSelect from "./employee-select";
import { EmployeeDialog } from "../employee-dialog";
import { Employee } from "@/lib/validations/employees";
import { useEmployees } from "../employees-provider";
import { createEmployee } from "@/actions/employees-action";

const EmployeeComboBox = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshEmployees } = useEmployees();

  const handleCreateEmployee = async (employeeData: Employee) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Create the employee using the API
      const response = await createEmployee({
        // Required fields with defaults
        employeeCode: employeeData.employeeCode || `EMP-${Date.now()}`,
        firstName: employeeData.firstName || "",
        lastName: employeeData.lastName || "",
        sex: employeeData.sex || "MALE",
        civilStatus: employeeData.civilStatus || "SINGLE",
        birthdate: employeeData.birthdate
          ? new Date(employeeData.birthdate)
          : new Date(),
        startDate: employeeData.startDate
          ? new Date(employeeData.startDate)
          : new Date(),
        position: employeeData.position || "Staff",
        department: employeeData.department || "General",
        employmentStatus: employeeData.employmentStatus || "PROBATIONARY",
        currentStatus: employeeData.currentStatus || "ACTIVE",
        nationality: employeeData.nationality || "Filipino",

        // Optional fields with null defaults
        middleName: employeeData.middleName || null,
        address: employeeData.address || null,
        img: employeeData.img || null,
        email: employeeData.email || null,
        phone: employeeData.phone || null,
        endDate: employeeData.endDate ? new Date(employeeData.endDate) : null,
        userId: employeeData.userId || null,
        suffix: employeeData.suffix || null,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to create employee");
      }

      // Refresh the employee list
      await refreshEmployees();
      setDialogOpen(false);
    } catch (err) {
      console.error("Error creating employee:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create employee"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-row">
        <EmployeeSearch />
        <EmployeeSelect />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button onClick={() => setDialogOpen(true)}>Create Employee</Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <EmployeeDialog
        employee={null}
        mode={dialogOpen ? "create" : null}
        onClose={() => setDialogOpen(false)}
        onSave={handleCreateEmployee}
        onArchive={() => {}}
      />
    </div>
  );
};

export default EmployeeComboBox;

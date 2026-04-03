import EmployeeDeductionsDirectoryPage from "@/features/manage-deductions/employee-deductions-directory-page";

export default function ManagerEmployeeDeductionsPage() {
  return (
    <EmployeeDeductionsDirectoryPage
      rolePath="manager"
      canManageAssignments
    />
  );
}

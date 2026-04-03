import EmployeeDeductionsDirectoryPage from "@/features/manage-deductions/employee-deductions-directory-page";

export default function AdminEmployeeDeductionsPage() {
  return (
    <EmployeeDeductionsDirectoryPage
      rolePath="admin"
      canManageAssignments
    />
  );
}

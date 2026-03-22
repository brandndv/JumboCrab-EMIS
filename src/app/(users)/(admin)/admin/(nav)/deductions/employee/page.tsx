import EmployeeDeductionsDirectoryPage from "@/components/dasboard/manage-deductions/employee-deductions-directory-page";

export default function AdminEmployeeDeductionsPage() {
  return (
    <EmployeeDeductionsDirectoryPage
      rolePath="admin"
      canManageAssignments
    />
  );
}

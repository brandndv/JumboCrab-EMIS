import EmployeeDeductionsDirectoryPage from "@/components/dasboard/manage-deductions/employee-deductions-directory-page";

export default function ManagerEmployeeDeductionsPage() {
  return (
    <EmployeeDeductionsDirectoryPage
      rolePath="manager"
      canManageAssignments
    />
  );
}

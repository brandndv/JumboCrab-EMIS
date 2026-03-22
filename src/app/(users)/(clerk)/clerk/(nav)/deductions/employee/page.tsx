import EmployeeDeductionsDirectoryPage from "@/components/dasboard/manage-deductions/employee-deductions-directory-page";

export default function ClerkEmployeeDeductionsPage() {
  return (
    <EmployeeDeductionsDirectoryPage
      rolePath="clerk"
      canManageAssignments={false}
    />
  );
}

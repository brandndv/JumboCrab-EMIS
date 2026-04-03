import DeductionAssignmentFormPage from "@/features/manage-deductions/deduction-assignment-form-page";

export default function ManagerDeductionAddPage() {
  return (
    <DeductionAssignmentFormPage
      mode="approved"
      cancelPath="/manager/deductions/employee"
      successPath="/manager/deductions/employee"
      title="Assign Deduction"
      description="Create or edit approved deduction assignments for employees."
    />
  );
}

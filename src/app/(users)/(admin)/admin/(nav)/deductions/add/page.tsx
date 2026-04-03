import DeductionAssignmentFormPage from "@/features/manage-deductions/deduction-assignment-form-page";

export default function AdminDeductionAddPage() {
  return (
    <DeductionAssignmentFormPage
      mode="approved"
      cancelPath="/admin/deductions/employee"
      successPath="/admin/deductions/employee"
      title="Assign Deduction"
      description="Create an approved employee deduction assignment."
    />
  );
}

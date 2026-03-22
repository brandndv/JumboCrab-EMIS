import DeductionAssignmentFormPage from "@/components/dasboard/manage-deductions/deduction-assignment-form-page";

export default function ClerkDeductionAddPage() {
  return (
    <DeductionAssignmentFormPage
      mode="draft"
      cancelPath="/clerk/deductions"
      successPath="/clerk/deductions"
      title="Create Deduction Draft"
      description="Prepare a deduction assignment draft for manager review."
    />
  );
}

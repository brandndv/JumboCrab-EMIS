import ContributionEditPage from "@/features/manage-contributions/contribution-edit-page";

export default function AdminContributionEditPage({
  params,
}: {
  params: { employeeId: string };
}) {
  return (
    <ContributionEditPage
      employeeId={params.employeeId}
      returnPath="/admin/contributions"
    />
  );
}

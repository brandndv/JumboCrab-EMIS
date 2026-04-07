import ContributionEditPage from "@/features/manage-contributions/contribution-edit-page";

export default function ManagerContributionEditPage({
  params,
}: {
  params: { employeeId: string };
}) {
  return (
    <ContributionEditPage
      employeeId={params.employeeId}
      returnPath="/manager/contributions"
    />
  );
}

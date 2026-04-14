import ContributionEditPage from "@/features/manage-contributions/contribution-edit-page";

export default async function AdminContributionEditPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  return (
    <ContributionEditPage
      employeeId={employeeId}
      returnPath="/admin/contributions"
    />
  );
}

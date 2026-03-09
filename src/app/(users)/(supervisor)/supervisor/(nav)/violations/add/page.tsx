import ViolationCreateForm from "@/components/dasboard/manage-violations/violation-create-form";

export default async function SupervisorViolationAddPage({
  searchParams,
}: {
  searchParams:
    | Promise<{ employeeId?: string }>
    | { employeeId?: string }
    | undefined;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const initialEmployeeId =
    typeof resolvedSearchParams.employeeId === "string"
      ? resolvedSearchParams.employeeId
      : null;

  return (
    <div className="space-y-4 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Draft Violation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a violation draft for manager review.
        </p>
      </div>
      <ViolationCreateForm
        initialEmployeeId={initialEmployeeId}
        cancelPath="/supervisor/violations"
      />
    </div>
  );
}

import ViolationCreateForm from "@/features/manage-violations/violation-create-form";

export default async function ViolationAddPage({
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
        <h1 className="text-2xl font-bold text-foreground">Add Violation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a created violation to a specific employee.
        </p>
      </div>
      <ViolationCreateForm initialEmployeeId={initialEmployeeId} />
    </div>
  );
}

import { getViolations } from "@/actions/violations-action";

// Minimal server component to exercise the getViolations action.
const ViolationsPage = async () => {
  // Await the action result; destructuring keeps the shape obvious.
  const { success, error, data } = await getViolations();

  if (!success || !data) {
    return (
      <div className="p-4 text-red-500">
        Failed to load violations: {error ?? "Unknown error"}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="p-4 text-muted-foreground">No violations found.</div>;
  }

  return (
    <div className="space-y-4 p-4">
      {data.map((violation) => (
        <div key={violation.id} className="rounded border p-3">
          <p className="font-semibold">
            {violation.employee?.firstName ?? "Unknown"}{" "}
            {violation.employee?.lastName ?? ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {violation.violationType} • {violation.status}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ViolationsPage;

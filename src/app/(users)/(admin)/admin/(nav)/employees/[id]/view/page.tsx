import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { getEmployeeById } from "@/actions/employees-action";
import EmployeeForm from "@/components/dasboard/manage-empoyees/employee-form";

export default async function EmployeeViewPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  // Resolve params if it's a Promise
  const resolvedParams = await Promise.resolve(params);
  const response = await getEmployeeById(resolvedParams.id);

  if (!response?.data) {
    notFound();
  }

  const employee = response.data;

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">View Employee</h3>
          <p className="text-sm text-muted-foreground">View employee details</p>
        </div>
        {employee.employeeId && (
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/admin/employees/${employee.employeeId}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>
      <EmployeeForm
        employeeId={employee.employeeId}
        mode="view"
        initialData={employee}
      />
    </div>
  );
}

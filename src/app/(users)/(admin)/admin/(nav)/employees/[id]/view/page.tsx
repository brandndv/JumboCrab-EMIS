"use client";

import { notFound } from "next/navigation";
import { getEmployeeById } from "@/actions/employees-action";
import EmployeeForm from "@/components/dasboard/manage-empoyees/employee-form";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Employee } from "@/lib/validations/employees";

interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

// Client component
function EmployeeViewPageContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const params = await paramsPromise;
        const employeeId = params?.id;

        if (!employeeId) {
          console.error("No employee ID provided");
          setError("No employee ID provided");
          setLoading(false);
          return;
        }

        console.log("Fetching employee with ID:", employeeId);
        const { data, error: fetchError } = await getEmployeeById(employeeId);

        if (fetchError || !data) {
          console.error("Error loading employee:", fetchError);
          setError(fetchError || "Failed to load employee");
          notFound();
          return;
        }

        setEmployee(data);
      } catch (err) {
        console.error("Error in EmployeeViewPage:", err);
        setError("Failed to load employee data");
        notFound();
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [paramsPromise]);

  if (loading) {
    return <div>Loading employee data...</div>;
  }

  if (error || !employee) {
    return <div>Error loading employee: {error}</div>;
  }

  return (
    <div className="space-y-6 py-10 px-5 md:px-20">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">View Employee</h3>
          <p className="text-sm text-muted-foreground">View employee details</p>
        </div>
        {employee?.id && (
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/admin/employees/${employee.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>
      {employee?.id && (
        <EmployeeForm
          employeeId={employee.id}
          mode="view"
          initialData={employee}
        />
      )}
    </div>
  );
}

// Server component wrapper
export default function EmployeeViewPage({
  params,
}: {
  params: { id: string };
}) {
  // Create a promise that resolves with the params
  const paramsPromise = Promise.resolve(params);

  return <EmployeeViewPageContent paramsPromise={paramsPromise} />;
}

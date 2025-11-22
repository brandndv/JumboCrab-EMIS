"use client";

import { notFound } from "next/navigation";
import { getEmployeeById } from "@/actions/employees-action";
import EmployeeForm from "@/components/dasboard/manage-empoyees/employee-form";
import { useEffect, useState } from "react";
import { Employee } from "@/lib/validations/employees";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: { id: string };
}

function EmployeeEditPageContent({
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
          console.error("No employee ID provided for edit");
          setError("No employee ID provided");
          setLoading(false);
          return;
        }

        console.log("Fetching employee for edit with ID:", employeeId);
        const { data, error: fetchError } = await getEmployeeById(employeeId);

        if (fetchError || !data) {
          console.error("Error loading employee for edit:", fetchError);
          setError(fetchError || "Failed to load employee");
          notFound();
          return;
        }

        // Normalize nullable fields from Prisma to match the Employee form type
        setEmployee({
          ...data,
          isEnded: data.isEnded ?? false,
          img: data.img ?? null,
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactRelationship:
            data.emergencyContactRelationship ?? null,
          emergencyContactPhone: data.emergencyContactPhone ?? null,
          emergencyContactEmail: data.emergencyContactEmail ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          postalCode: data.postalCode ?? null,
          country: data.country ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          description: data.description ?? null,
        });
      } catch (err) {
        console.error("Error in EmployeeEditPage:", err);
        setError("Failed to load employee data");
        notFound();
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [paramsPromise]);

  if (loading) {
    return <div className="p-4">Loading employee data...</div>;
  }

  if (error || !employee) {
    return (
      <div className="p-4 text-red-600">Error loading employee: {error}</div>
    );
  }

  return (
    <div className="space-y-6 py-10 px-5 md:px-20">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">Edit Employee</h3>
          <p className="text-sm text-muted-foreground">
            Update employee details
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/admin/employees/${employee.employeeId}/view`}>
            <ArrowLeft className="h-4 w-4" />
            Back to View
          </Link>
        </Button>
      </div>
      {employee?.employeeId && (
        <EmployeeForm
          employeeId={employee.employeeId}
          mode="edit"
          initialData={employee}
        />
      )}
    </div>
  );
}

// Server component wrapper
export default function EmployeeEditPage({
  params,
}: {
  params: { id: string };
}) {
  // Create a promise that resolves with the params
  const paramsPromise = Promise.resolve(params);

  return <EmployeeEditPageContent paramsPromise={paramsPromise} />;
}

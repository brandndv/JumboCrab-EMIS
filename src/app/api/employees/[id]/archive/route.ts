// src/app/api/employees/[id]/archive/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: { id?: string } } | { params: Promise<{ id?: string }> }
) {
  const resolvedParams = await Promise.resolve(
    (context as any)?.params ?? { id: undefined }
  );
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idFromPath = segments[segments.length - 2];
  const employeeId = resolvedParams?.id ?? idFromPath;

  try {
    const { isArchived = true } = await request.json().catch(() => ({}));

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    // First, get the existing employee with user relation
    const existing = await db.employee.findUnique({
      where: { employeeId },
      include: { user: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Employee with ID ${employeeId} not found` },
        { status: 404 }
      );
    }

    // Update only the employee's archive status
    const employee = await db.employee.update({
      where: { employeeId },
      data: {
        isArchived: Boolean(isArchived),
        updatedAt: new Date(),
      },
    });

    // If there's an associated user, update their isDisabled status
    if (existing.user) {
      await db.user.update({
        where: { userId: existing.user.userId },
        data: { isDisabled: Boolean(isArchived) },
      });
    }

    return NextResponse.json({
      success: true,
      employee,
      userUpdated: !!existing.user,
    });
  } catch (error) {
    console.error(`Failed to update employee ${employeeId}:`, error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update employee status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await Promise.resolve(
      (context as any)?.params ?? { id: undefined }
    );

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const employee = await db.employee.findUnique({
      where: { employeeId },
    });
    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID ${employeeId} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Failed to fetch employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(
      (context as any)?.params ?? { id: undefined }
    );
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const idFromPath = segments[segments.length - 1];
    const employeeId = resolvedParams?.id ?? idFromPath;

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: `Employee with ID ${employeeId} not found` },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.employee.update({
          where: { employeeId },
          data: { userId: null },
        });
      }
      await tx.employee.delete({ where: { employeeId } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}

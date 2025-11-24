import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        departmentId: true,
        name: true,
        description: true,
        positions: {
          select: {
            positionId: true,
            name: true,
            employees: {
              select: {
                employeeId: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        employees: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: { select: { name: true, positionId: true } },
          },
        },
      },
    });
    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    console.error("Failed to fetch departments", error);
    return NextResponse.json(
      { success: false, error: "Failed to load departments" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const existing = await db.department.findFirst({
      where: { name, isActive: true },
      select: { departmentId: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Department already exists" },
        { status: 409 }
      );
    }

    const department = await db.department.create({
      data: { name, description },
      select: { departmentId: true, name: true, description: true },
    });

    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Failed to create department", error);
    return NextResponse.json(
      { success: false, error: "Failed to create department" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const departmentId =
      typeof body?.departmentId === "string" ? body.departmentId.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: "Department ID is required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    const existingDept = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!existingDept) {
      return NextResponse.json(
        { success: false, error: "Department not found" },
        { status: 404 }
      );
    }

    const conflict = await db.department.findFirst({
      where: {
        departmentId: { not: departmentId },
        name,
        isActive: true,
      },
      select: { departmentId: true },
    });
    if (conflict) {
      return NextResponse.json(
        { success: false, error: "Another department already uses this name" },
        { status: 409 }
      );
    }

    const department = await db.department.update({
      where: { departmentId },
      data: { name, description },
      select: { departmentId: true, name: true, description: true },
    });

    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error("Failed to update department", error);
    return NextResponse.json(
      { success: false, error: "Failed to update department" },
      { status: 500 }
    );
  }
}

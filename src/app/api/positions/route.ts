import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const positions = await db.position.findMany({
      where: { isActive: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
        employees: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error("Failed to fetch positions", error);
    return NextResponse.json(
      { success: false, error: "Failed to load positions" },
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
    const departmentId =
      typeof body?.departmentId === "string" ? body.departmentId.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }
    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: "Department is required" },
        { status: 400 }
      );
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return NextResponse.json(
        { success: false, error: "Department not found" },
        { status: 404 }
      );
    }

    const existing = await db.position.findFirst({
      where: { name, departmentId, isActive: true },
      select: { positionId: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Position already exists in this department" },
        { status: 409 }
      );
    }

    const position = await db.position.create({
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: position });
  } catch (error) {
    console.error("Failed to create position", error);
    return NextResponse.json(
      { success: false, error: "Failed to create position" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const positionId =
      typeof body?.positionId === "string" ? body.positionId.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;
    const departmentId =
      typeof body?.departmentId === "string" ? body.departmentId.trim() : "";

    if (!positionId) {
      return NextResponse.json(
        { success: false, error: "Position ID is required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }
    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: "Department is required" },
        { status: 400 }
      );
    }

    const position = await db.position.findUnique({
      where: { positionId },
      select: { positionId: true },
    });
    if (!position) {
      return NextResponse.json(
        { success: false, error: "Position not found" },
        { status: 404 }
      );
    }

    const department = await db.department.findUnique({
      where: { departmentId },
      select: { departmentId: true },
    });
    if (!department) {
      return NextResponse.json(
        { success: false, error: "Department not found" },
        { status: 404 }
      );
    }

    const conflict = await db.position.findFirst({
      where: {
        positionId: { not: positionId },
        name,
        departmentId,
        isActive: true,
      },
      select: { positionId: true },
    });
    if (conflict) {
      return NextResponse.json(
        { success: false, error: "Another position in this department uses this name" },
        { status: 409 }
      );
    }

    const updated = await db.position.update({
      where: { positionId },
      data: { name, description, departmentId },
      select: {
        positionId: true,
        name: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update position", error);
    return NextResponse.json(
      { success: false, error: "Failed to update position" },
      { status: 500 }
    );
  }
}

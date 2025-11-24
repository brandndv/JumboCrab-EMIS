import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [employees, supervisors] = await Promise.all([
      db.employee.findMany({
        where: { isArchived: false },
        orderBy: { employeeCode: "asc" },
        select: {
          employeeId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          supervisorUserId: true,
          user: { select: { userId: true, role: true, username: true, email: true } },
          department: { select: { departmentId: true, name: true } },
          position: { select: { positionId: true, name: true } },
        },
      }),
      db.user.findMany({
        where: { role: { in: ["admin", "generalManager", "manager", "supervisor"] } },
        select: { userId: true, username: true, email: true, role: true },
        orderBy: { username: "asc" },
      }),
    ]);

    const payload = employees.map((e) => ({
      ...e,
      role: e.user?.role ?? null,
      user: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: payload,
      supervisors,
    });
  } catch (error) {
    console.error("Failed to fetch organization structure", error);
    return NextResponse.json(
      { success: false, error: "Failed to load structure" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
    const supervisorId =
      typeof body?.supervisorUserId === "string" && body.supervisorUserId.trim() !== ""
        ? body.supervisorUserId.trim()
        : null;

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }
    // Validate employee exists
    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true },
    });
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }

    // Validate supervisor if provided
    if (supervisorId) {
      const supervisor = await db.user.findUnique({
        where: { userId: supervisorId },
        select: { userId: true },
      });
      if (!supervisor) {
        return NextResponse.json(
          { success: false, error: "Supervisor not found" },
          { status: 404 }
        );
      }
    }

    await db.employee.update({
      where: { employeeId },
      data: { supervisorUserId: supervisorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update supervisor", error);
    return NextResponse.json(
      { success: false, error: "Failed to update supervisor" },
      { status: 500 }
    );
  }
}

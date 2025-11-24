import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Roles } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

const selectableUserFields = {
  userId: true,
  username: true,
  email: true,
  role: true,
  isDisabled: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      positionId: true,
      departmentId: true,
      position: {
        select: {
          positionId: true,
          name: true,
          departmentId: true,
          department: { select: { departmentId: true, name: true } },
        },
      },
      department: { select: { departmentId: true, name: true } },
      supervisorUser: {
        select: {
          userId: true,
          username: true,
          email: true,
          role: true,
        },
      },
      employmentStatus: true,
      currentStatus: true,
      startDate: true,
      endDate: true,
      img: true,
    },
  },
};

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(req: NextRequest, ctx: ParamsInput) {
  const resolved = await Promise.resolve(ctx.params);
  return (
    resolved?.id ??
    req.nextUrl.pathname
      .split("/")
      .filter(Boolean)
      .pop()
  );
}

export async function GET(req: NextRequest, ctx: ParamsInput) {
  const id = await resolveId(req, ctx);

  if (!id) {
    return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { userId: id },
    select: selectableUserFields,
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, ctx: ParamsInput) {
  const id = await resolveId(req, ctx);

  if (!id) {
    return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
  }

  const body = await req.json();
  const { username, email, role, password, isDisabled } = body ?? {};

  const updates: Record<string, unknown> = {};

  if (typeof username === "string") updates.username = username.trim();
  if (typeof email === "string") updates.email = email.trim();
  if (typeof isDisabled === "boolean") updates.isDisabled = isDisabled;

  if (role !== undefined) {
    const validRoles = Object.values(Roles);
    const normalizedRole = role as Roles;
    if (!validRoles.includes(normalizedRole)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }
    updates.role = normalizedRole;
  }

  if (password) {
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const { salt, hash } = await hashPassword(password);
    updates.password = hash;
    updates.salt = salt;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid fields provided to update" },
      { status: 400 }
    );
  }

  // Ensure username/email uniqueness if provided
  if (updates.username) {
    const existing = await db.user.findFirst({
      where: { username: updates.username as string, NOT: { userId: id } },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Username already in use" },
        { status: 400 }
      );
    }
  }

  if (updates.email) {
    const existingEmail = await db.user.findFirst({
      where: { email: updates.email as string, NOT: { userId: id } },
    });
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "Email already in use" },
        { status: 400 }
      );
    }
  }

  const updatedUser = await db.user.update({
    where: { userId: id },
    data: updates,
    select: selectableUserFields,
  });

  // Keep employee archive state in sync with user disable state
  if (typeof isDisabled === "boolean" && updatedUser.employee?.employeeId) {
    await db.employee.update({
      where: { employeeId: updatedUser.employee.employeeId },
      data: { isArchived: isDisabled },
    });
  }

  return NextResponse.json({ success: true, data: updatedUser });
}

export async function DELETE(req: NextRequest, ctx: ParamsInput) {
  const id = await resolveId(req, ctx);

  if (!id) {
    return NextResponse.json(
      { success: false, error: "User ID is required" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { userId: id },
    include: { employee: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  if (user.employee?.employeeId) {
    await db.employee.update({
      where: { employeeId: user.employee.employeeId },
      data: { userId: null },
    });
  }

  await db.user.delete({ where: { userId: id } });

  return NextResponse.json({ success: true });
}

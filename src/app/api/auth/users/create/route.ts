import { hashPassword } from "@/lib/auth";

import { NextRequest, NextResponse } from "next/server";
import { Roles } from "@prisma/client";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, role, employeeId } =
      await request.json();

    console.log("Received request with:", {
      username,
      email,
      role,
      employeeId,
    });

    // Validate required fields
    if (!username || !password || !email || !role) {
      return NextResponse.json(
        { error: "Username, email, password, and role are required" },
        { status: 400 }
      );
    }

    // If role is employee, employeeId is required
    if (role === "employee" && !employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required for employee role" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      console.log("User already exists:", { username, email });
      return NextResponse.json(
        {
          error:
            existingUser.username === username
              ? "Username already in use"
              : "Email already in use",
        },
        { status: 400 }
      );
    }

    // Role validation
    const validRoles = Object.values(Roles);
    const roleValue = role.toString().trim();
    const normalizedRole =
      roleValue.charAt(0).toLowerCase() + roleValue.slice(1);

    if (!validRoles.includes(normalizedRole as Roles)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if employee exists and is not already associated with a user
    if (role === "employee" && employeeId) {
      const employee = await db.employee.findUnique({
        where: { employeeId: employeeId },
        include: { user: true },
      });

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      if (employee.user) {
        return NextResponse.json(
          { error: "This employee is already associated with a user account" },
          { status: 400 }
        );
      }
    }

    const { salt, hash } = await hashPassword(password);

    // Create user with employee association if applicable
    const userData = {
      username,
      email,
      password: hash,
      salt,
      role: normalizedRole as Roles,
      isDisabled: false,
      ...(role === "employee" &&
        employeeId && {
          employee: {
            connect: { employeeId: employeeId },
          },
        }),
    };

    // First create the user
    const user = await db.user.create({
      data: userData,
      select: {
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
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

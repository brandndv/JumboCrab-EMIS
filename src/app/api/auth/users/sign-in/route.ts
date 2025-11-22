// src/app/api/auth/users/sign-in/route.ts
import { NextResponse } from "next/server";
import { getSession, signIn } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const result = await signIn(username, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Invalid credentials" },
        { status: 401 }
      );
    }

    if (result.user?.isDisabled) {
      return NextResponse.json(
        { error: "Account is disabled. Contact an administrator." },
        { status: 403 }
      );
    }

    // Set session cookie
    const session = await getSession();
    session.userId = result.user?.userId;
    session.username = result.user?.username;
    session.email = result.user?.email;
    session.role = result.user?.role;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        userId: result.user?.userId,
        username: result.user?.username,
        email: result.user?.email,
        role: result.user?.role,
      },
    });
  } catch (error) {
    console.error("Sign in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

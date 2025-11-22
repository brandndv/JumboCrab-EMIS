import { getSession, signIn } from "@/lib/auth";
import { Roles } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      console.log("Missing required fields");
      return NextResponse.json(
        { error: "Fields are required" },
        { status: 400 }
      );
    }

    const result = await signIn(username, password);

    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: result.error || "Failed to create user" },
        { status: 400 }
      );
    }

    if (result.user.isDisabled) {
      return NextResponse.json(
        { error: "Account is disabled. Contact an administrator." },
        { status: 403 }
      );
    }
    // Create session for the new user
    const session = await getSession();
    session.userId = result.user.userId;
    session.username = result.user.username;
    session.email = result.user.email;
    session.role = result.user.role;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json(
      {
        success: true,
        user: {
          userId: session.userId,
          username: session.username,
          email: session.email,
          role: session.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sign in error: ", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

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
    // Create session for the new user
    const session = await getSession();
    session.Id = result.user.id;
    session.username = result.user.username;
    session.email = result.user.email;
    session.role = result.user.role;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json(
      {
        success: true,
        user: {
          id: session.Id,
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

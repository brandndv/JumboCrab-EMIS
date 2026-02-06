// src/app/api/auth/sign-out/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getIronSession(await cookies(), sessionOptions);
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sign out" },
      { status: 500 },
    );
  }
}

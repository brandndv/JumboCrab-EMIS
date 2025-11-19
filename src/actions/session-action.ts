"use server";

import { getSession } from "@/lib/auth";

export async function fetchSession() {
  try {
    const session = await getSession();
    const plainSession = {
      id: session.Id ?? undefined,
      username: session.username ?? undefined,
      email: session.email ?? undefined,
      role: session.role ?? undefined,
      isLoggedIn: Boolean(session.isLoggedIn),
    };
    return { success: true, session: plainSession };
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve the current session",
    };
  }
}

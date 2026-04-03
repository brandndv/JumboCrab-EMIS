"use server";

import { getCurrentPlainSession } from "@/lib/current-session";

export async function fetchSession() {
  try {
    return {
      success: true,
      session: (await getCurrentPlainSession()) ?? { isLoggedIn: false },
    };
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

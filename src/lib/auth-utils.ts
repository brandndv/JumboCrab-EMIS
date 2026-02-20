// src/lib/auth-utils.ts
"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Roles } from "@prisma/client";
import { sessionOptions } from "./auth";

interface UserSession {
  id?: string;
  role?: Roles;
  email?: string;
  isLoggedIn: boolean;
}

export async function getRole(): Promise<Roles | null> {
  const session = await getIronSession<UserSession>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: "jumbo-auth",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  });

  if (!session.isLoggedIn || !session.role) {
    return null;
  }

  return session.role;
}

export async function requireRole(allowedRoles: Roles[]) {
  const role = await getRole();

  if (!role || !allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  return role;
}

export async function requireAuth() {
  const session = await getIronSession<UserSession>(await cookies(), {
    password: process.env.SESSION_PASSWORD!,
    cookieName: "jumbo-auth",
  });

  if (!session.isLoggedIn) {
    redirect("/login");
  }

  return session;
}

// ======== SIGN OUT ======== //
export async function signOut() {
  const session = await getIronSession(await cookies(), sessionOptions);
  session.destroy();
  return { success: true };
}

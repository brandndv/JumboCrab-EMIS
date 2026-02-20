import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { Roles } from "@prisma/client";

export type sessionData = {
  userId?: string;
  username?: string;
  email?: string;
  role?: Roles;
  isLoggedIn: boolean;
};

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: "jumbo-auth",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<sessionData>(
    cookieStore,
    sessionOptions
  );

  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }
  return session;
}

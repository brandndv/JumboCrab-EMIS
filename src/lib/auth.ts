import { promisify } from "util";
import crypto from "crypto";
import { Roles } from "@prisma/client";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { db } from "./db";

export async function createUserAccount(
  username: string,
  email: string,
  password: string,
  role: Roles
) {
  try {
    const existingUser = await db.user.findUnique({ where: { username } });
    if (existingUser) return { success: false, error: "User already exists" };

    const { salt, hash } = await hashPassword(password); // Added await here
    const user = await db.user.create({
      data: {
        username,
        email,
        password: hash,
        salt,
        role,
        isArchived: false,
      },
    });
    return { success: true, user }; // Fixed return statement
  } catch (error) {
    console.error("Create user account error", error);
    return { success: false, error: "Failed to create user account" };
  }
}

const scyrptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scyrptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return { salt, hash: derivedKey.toString("hex") };
}

export type sessionData = {
  Id?: string;
  username?: string;
  email?: string;
  role?: Roles;
  isLoggedIn: boolean;
};

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: "jumbo-auth",
  cookieOption: {
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

export async function getUserRole(): Promise<Roles | null> {
  const session = await getSession();
  return session.role || null;
}
// ======== SIGN IN LOGIC ======== //

export async function signIn(username: string, password: string) {
  try {
    const user = await db.user.findUnique({ where: { username } });
    if (!user) return { success: false, error: "Invalid credentials" };
    const isValid = await verifyPassword(password, user.password, user.salt);

    if (!isValid) return { success: false, error: "Invalid credentials" };
    return { success: true, user };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Failed to sign in" };
  }
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
) {
  const derivedKey = (await scyrptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey);
}

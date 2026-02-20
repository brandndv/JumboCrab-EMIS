import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import {
  getAllowedRolesForPath,
  getHomePathForRole,
  getRoleFromPath,
  normalizeRole,
  toCanonicalRolePath,
} from "@/lib/rbac";

type SessionPayload = {
  isLoggedIn?: boolean;
  role?: string;
};

const SESSION_COOKIE_NAME = "jumbo-auth";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/offline" ||
    pathname.startsWith("/sign-in")
  );
}

function createRedirect(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(url);
}

async function readSession(request: NextRequest) {
  const sealedSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const password = process.env.SESSION_PASSWORD;

  if (!sealedSession || !password) {
    return { isLoggedIn: false, role: null };
  }

  try {
    const session = await unsealData<SessionPayload>(sealedSession, {
      password,
    });

    return {
      isLoggedIn: Boolean(session?.isLoggedIn),
      role: normalizeRole(session?.role),
    };
  } catch {
    return { isLoggedIn: false, role: null };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const canonicalPath = toCanonicalRolePath(pathname);
  const session = await readSession(request);

  if (!session.isLoggedIn || !session.role) {
    return redirectToSignIn(request);
  }

  const roleFromPath = getRoleFromPath(pathname);
  if (roleFromPath && roleFromPath !== session.role) {
    return createRedirect(request, getHomePathForRole(session.role));
  }

  const allowedRoles = getAllowedRolesForPath(canonicalPath);
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    const homePath = getHomePathForRole(session.role);
    if (pathname !== homePath) {
      return createRedirect(request, homePath);
    }
  }

  if (canonicalPath !== pathname) {
    return createRedirect(request, canonicalPath);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

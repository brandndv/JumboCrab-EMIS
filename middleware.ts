import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./src/lib/middleware-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to auth pages, API routes, and static assets
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const session = await getSession();

  if (!session.isLoggedIn) {
    // Redirect to sign-in page if not authenticated
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Role-based access control
  const userRole = session.role?.toLowerCase();

  // Check if user is trying to access their own role-based routes
  if (pathname.startsWith("/admin/") && userRole !== "admin") {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/employee/") && userRole !== "employee") {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/manager/") && userRole !== "manager") {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sign-in (auth page)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sign-in).*)",
  ],
};

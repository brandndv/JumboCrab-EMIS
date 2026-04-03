import { runRouteGuard } from "@/lib/route-guard";

export const proxy = runRouteGuard;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

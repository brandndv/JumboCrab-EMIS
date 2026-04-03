import { runRouteGuard } from "@/lib/route-guard";

export const middleware = runRouteGuard;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/checkout")
  ) {
    return;
  }

  const isAuthenticated = request.cookies.has("tosms_admin_auth");

  if (!isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return;
}

export const config = {
  matcher: ["/((?!login|checkout|_next|api|favicon.ico).*)"],
};

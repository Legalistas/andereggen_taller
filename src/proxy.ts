import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always redirect root path to signin
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/auth/signin", "/auth/error", "/api/auth"];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Admin/Internal dashboard routes
  const adminRoutes = ["/dashboard", "/admin", "/users", "/settings"];

  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // If accessing admin routes, redirect to signin
  // The actual authentication and authorization will be handled in the page components
  if (isAdminRoute) {
    // Check for session token (basic check)
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value;

    if (!sessionToken) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run proxy on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

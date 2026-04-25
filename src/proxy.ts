import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root → signin
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  // Rutas públicas que NO requieren auth.
  const publicRoutes = [
    "/auth/signin",
    "/auth/signup",
    "/auth/error",
    "/auth/verify-email",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/two-factor",
    "/api/auth",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Rutas protegidas → check rápido de cookie (la validación real la hace el server component).
  const protectedRoutes = [
    "/dashboard",
    "/admin",
    "/users",
    "/settings",
    "/perfil",
    "/configuracion",
    "/crm",
    "/customers",
    "/inventario",
    "/produccion",
    "/reportes",
    "/estadisticas",
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtectedRoute) {
    const sessionToken =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value;

    if (!sessionToken) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

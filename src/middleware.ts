import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "seam_auth";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/leads/webhook",
  "/api/meta/webhook",
  "/api/meta/callback",
  "/api/cron/follow-up",
  "/api/gmail/callback",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authCookie?.value) {
    // Redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

/**
 * Validate Origin header on mutating requests to prevent CSRF.
 * Returns true if the request is safe (GET/HEAD/OPTIONS or valid Origin).
 */
function isOriginAllowed(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  // Safe methods don't need CSRF protection
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // M-Pesa callback comes from Safaricom without an Origin header
  if (request.nextUrl.pathname === "/api/payments/callback") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // No origin header — could be a server-to-server call or non-browser client.
    // Block in production to prevent CSRF; allow in dev for curl/Postman.
    return !ALLOWED_ORIGIN;
  }

  if (!ALLOWED_ORIGIN) return true; // No ALLOWED_ORIGIN configured — dev mode

  return origin === ALLOWED_ORIGIN;
}

export async function middleware(request: NextRequest) {
  // Skip session handling for M-Pesa callback (Safaricom won't send cookies)
  if (request.nextUrl.pathname === "/api/payments/callback") {
    return NextResponse.next();
  }

  // CSRF protection: verify Origin on mutating requests
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Forbidden: invalid origin" },
      { status: 403 }
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

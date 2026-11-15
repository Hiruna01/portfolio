import { NextResponse, type NextRequest } from "next/server";

// First gate for the admin area: no session cookie, no admin pages.
// This is only a fast pre-check. The real check (is the session valid?) runs on the server
// in every admin page and every admin action, in lib/auth.ts.

const COOKIE = process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Every /admin path except the login page itself.
  matcher: ["/admin", "/admin/((?!login$).*)"],
};

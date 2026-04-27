import { NextRequest, NextResponse } from "next/server";

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get("access-token")?.value;

  if (!token || isExpired(token)) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // /auth/* and /api/auth/* are intentionally excluded — they are part of the OAuth flow.
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};

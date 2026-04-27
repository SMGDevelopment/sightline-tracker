import { NextRequest, NextResponse } from "next/server";

type AuthResult =
  | { userId: string; errorResponse: null }
  | { userId: null; errorResponse: NextResponse };

export function requireAuth(request: NextRequest): AuthResult {
  const idToken = request.cookies.get("id-token")?.value;

  if (!idToken) {
    return { userId: null, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { userId: null, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { userId: payload.sub as string, errorResponse: null };
  } catch {
    return { userId: null, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

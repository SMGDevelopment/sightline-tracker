import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/powertools";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const storedState = request.cookies.get("oauth-state")?.value;
  const codeVerifier = request.cookies.get("pkce-verifier")?.value;

  if (!code || !codeVerifier || state !== storedState) {
    logger.warn("Auth callback rejected", {
      reason: !code ? "missing_code" : !codeVerifier ? "missing_verifier" : "state_mismatch",
    });
    return NextResponse.redirect(`${origin}/?error=invalid_callback`);
  }

  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    || "ap-feed-manager-auth.auth.us-east-1.amazoncognito.com";
  const tokenRes = await fetch(`https://${cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      code,
      redirect_uri: `${origin}/api/auth/callback`,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    logger.error("Token exchange failed", { statusCode: tokenRes.status, error: err });
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(err)}`);
  }

  const { id_token, access_token, refresh_token } = await tokenRes.json();
  logger.info("Login succeeded");

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.set("id-token", id_token, COOKIE_OPTS);
  response.cookies.set("access-token", access_token, COOKIE_OPTS);
  response.cookies.set("refresh-token", refresh_token, COOKIE_OPTS);
  // Clear the PKCE cookies
  response.cookies.delete("pkce-verifier");
  response.cookies.delete("oauth-state");
  return response;
}

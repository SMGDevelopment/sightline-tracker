import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/powertools";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // 10 min — plenty of time to complete the login
};

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    || "ap-feed-manager-auth.auth.us-east-1.amazoncognito.com";
  const authUrl = new URL(`https://${cognitoDomain}/oauth2/authorize`);
  authUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "email openid profile");
  authUrl.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  logger.info("Login initiated", { state });

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("pkce-verifier", codeVerifier, COOKIE_OPTS);
  response.cookies.set("oauth-state", state, COOKIE_OPTS);
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/powertools";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    || "ap-feed-manager-auth.auth.us-east-1.amazoncognito.com";

  // Cognito's logout endpoint clears the Cognito SSO session. Without this,
  // the user is silently re-authenticated the next time the proxy redirects
  // them to the hosted UI — they never see a login prompt.
  const logoutUrl = new URL(`https://${cognitoDomain}/logout`);
  logoutUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!);
  logoutUrl.searchParams.set("logout_uri", origin);

  logger.info("User signing out");

  // Return the Cognito logout URL to the client. Cookies are cleared in this
  // response; the client then navigates to the Cognito URL to end the SSO
  // session, which redirects back to origin when done.
  //
  // Must specify path: "/" to match how the cookies were originally set.
  // Without this, the browser's default path is derived from the request URL
  // (/api/auth), and the Set-Cookie headers don't apply to the cookies at
  // path=/ — leaving the old tokens in the browser's cookie jar.
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  const response = NextResponse.json({ logoutUrl: logoutUrl.toString() });
  response.cookies.set("id-token", "", clearOpts);
  response.cookies.set("access-token", "", clearOpts);
  response.cookies.set("refresh-token", "", clearOpts);
  return response;
}

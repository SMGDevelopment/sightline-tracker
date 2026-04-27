// ---------------------------------------------------------------------------
// Cognito User Pool — references an existing pool in AWS.
//
// The pool is NOT managed by SST. It will never be modified or deleted by
// infrastructure changes. Only the app client is managed per-stage.
//
// To use a different pool per stage, add an entry to POOL_IDS.
// The "default" entry is used for any stage not explicitly listed.
// ---------------------------------------------------------------------------

const POOL_IDS: Record<string, string> = {
  // production: "us-east-1_REPLACE_ME",
  default: "us-east-1_VsrpkfDO8",
};

export const userPoolId: string = POOL_IDS[$app.stage] ?? POOL_IDS.default;

// ---------------------------------------------------------------------------
// OAuth callback URLs
// ---------------------------------------------------------------------------
// The Cognito hosted UI redirects here after sign-in and sign-out.
// Dev stages always include localhost. Add your production domain below.
// ---------------------------------------------------------------------------

const isProd = $app.stage === "production";

const callbackUrls = [
  ...(isProd ? [] : ["http://localhost:3000/api/auth/callback"]),
  ...(isProd ? ["https://vibe-demo.militarytimes.com/api/auth/callback"] : []),
];

const logoutUrls = [
  ...(isProd ? [] : ["http://localhost:3000"]),
  ...(isProd ? ["https://vibe-demo.militarytimes.com"] : []),
];

// Each stage gets its own app client in the shared pool.
// The client is managed by SST — created on first deploy, removed with the stage.
export const userPoolClient = new aws.cognito.UserPoolClient("WebClient", {
  name: $interpolate`${$app.name}-${$app.stage}-web-client`,
  userPoolId,

  // Enable the Entra ID SSO provider alongside the built-in user pool.
  supportedIdentityProviders: ["COGNITO", "mco-com-idp"],

  // OAuth / hosted UI — required for federated sign-in via mco-idp.
  allowedOauthFlowsUserPoolClient: true,
  allowedOauthFlows: ["code"],
  allowedOauthScopes: ["email", "openid", "profile"],
  callbackUrls,
  logoutUrls,

  explicitAuthFlows: [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ],
  preventUserExistenceErrors: "ENABLED",

  // Uncomment to tune token lifetimes:
  // accessTokenValidity: 1,
  // idTokenValidity: 1,
  // refreshTokenValidity: 30,
  // tokenValidityUnits: { accessToken: "hours", idToken: "hours", refreshToken: "days" },
});

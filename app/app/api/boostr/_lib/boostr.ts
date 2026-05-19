// ---------------------------------------------------------------------------
// Boostr API client — shared by the three route handlers
// ---------------------------------------------------------------------------
// THREE BOOSTR API COMMANDMENTS — DO NOT VIOLATE:
//   1. Authorization header is RAW JWT (no "Bearer " prefix)
//   2. Accept: application/vnd.boostr.public on EVERY request
//   3. /api/ios?io_number={x} returns a LIST — use [0].id
//
// Token cache lives at module scope. In Next.js Lambda, modules persist
// across warm invocations within the same instance, so frequent users get
// cache hits. Cold starts get a fresh empty cache. JWTs eventually expire;
// if you see 401s after long warm periods, restart the Lambda or add
// retry-on-401 logic here.
// ---------------------------------------------------------------------------

const BOOSTR_BASE_URL = "https://app.boostr.com";

// In-memory cache: "email|baseUrl" → JWT
const tokenCache = new Map<string, string>();

/**
 * Low-level Boostr API request. Returns parsed JSON or throws.
 * Always sets the required Accept header. Includes the JWT as a raw
 * Authorization header (no Bearer prefix).
 */
export async function boostrRequest(
  method: string,
  path: string,
  jwt?: string,
  body?: unknown
): Promise<any> {
  const headers: Record<string, string> = {
    // REQUIRED on every call. Without it, even valid JWTs return 401.
    "Accept": "application/vnd.boostr.public",
    "Content-Type": "application/json",
  };
  if (jwt) {
    // CRITICAL: NO "Bearer " prefix.
    headers["Authorization"] = jwt;
  }

  const resp = await fetch(BOOSTR_BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // 15 second timeout matches the Python proxy. AbortSignal.timeout is
    // supported in Node 18+ which Next.js's runtime ships.
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Boostr ${method} ${path} -> ${resp.status}: ${msg}`);
  }

  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Get a JWT for these credentials, cached per-instance.
 * Throws if Boostr rejects the credentials or returns no jwt.
 */
export async function authenticate(
  email: string,
  password: string
): Promise<string> {
  const cacheKey = `${email}|${BOOSTR_BASE_URL}`;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

  const resp = await boostrRequest("POST", "/api/user_token", undefined, {
    auth: { email, password },
  });
  const jwt = resp?.jwt;
  if (!jwt || typeof jwt !== "string") {
    throw new Error("Authentication succeeded but no jwt in response");
  }
  tokenCache.set(cacheKey, jwt);
  return jwt;
}

/**
 * Look up Boostr's internal IO ID by io_number (Deal ID column in the sheet).
 * Returns the numeric ID. Throws if no IO matches.
 */
export async function findIoId(jwt: string, dealId: string | number): Promise<number> {
  // CRITICAL: this endpoint returns a LIST, not a single object.
  const ios = await boostrRequest("GET", `/api/ios?io_number=${encodeURIComponent(String(dealId))}`, jwt);
  if (!Array.isArray(ios) || ios.length === 0) {
    throw new Error(`No IO found with io_number=${dealId}`);
  }
  return ios[0].id;
}

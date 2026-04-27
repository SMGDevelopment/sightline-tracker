// ---------------------------------------------------------------------------
// Typed API client — uses relative URLs (no CORS, no auth headers needed).
// ---------------------------------------------------------------------------
// The Next.js app and its Route Handlers share the same CloudFront domain,
// so /api/... paths resolve correctly in both the browser and during SSR.
// Authentication is handled server-side via cookies set by the PKCE flow —
// the browser sends them automatically with every request.
//
// Usage:
//   const items = await apiClient.get<Item[]>("/items");
//   await apiClient.post("/items", { name: "New item" });
// ---------------------------------------------------------------------------

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} /api${path} failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

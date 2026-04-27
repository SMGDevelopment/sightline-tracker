"use client";

// Auth is handled entirely via the custom PKCE flow in app/api/auth/*.
// This component is kept as a placeholder in case client-side providers are
// needed in the future. It currently renders children as-is.
export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

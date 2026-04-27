// Opt out of static pre-rendering — this page throws intentionally, so it must
// only run at request time or the build will fail.
export const dynamic = "force-dynamic";

// This page intentionally throws a server-side error so you can verify that:
//   1. The error page renders with a Reference ID
//   2. CloudWatch Logs contains an "Unhandled request error" entry with that
//      digest and the xray_trace_id — use both to find the X-Ray trace.
//
// Remove this page (and the link from the dashboard) before going to production.
export default async function TestErrorPage() {
  await Promise.resolve(); // yield before throwing so Next.js can set the perf mark
  throw new Error("Test error — triggered intentionally from /test-error");
}

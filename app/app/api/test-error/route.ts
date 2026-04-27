import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-server";

// GET /api/test-error — intentionally throws so you can verify that:
//   1. CloudWatch Logs contains an "Unhandled request error" entry with the digest
//      and xray_trace_id (logged by onRequestError in instrumentation.ts)
//   2. The Fault metric is emitted to CloudWatch
//
// Remove this route before going to production.
export async function GET(request: NextRequest) {
  const { errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  throw new Error("Test API error — triggered intentionally from GET /api/test-error");
}

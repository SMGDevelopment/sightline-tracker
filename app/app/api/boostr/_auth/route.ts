// ---------------------------------------------------------------------------
// POST /api/boostr/auth
// ---------------------------------------------------------------------------
// Tests Boostr credentials. Returns { ok: true, message } on success,
// { ok: false, message } on any auth failure (wrong password, network error,
// etc.). Returning 200 with ok:false for domain errors lets the client show
// a friendly message without treating it as a network failure.
//
// Special case: if email === "__ping__", we don't actually call Boostr.
// This lets the client cheaply check whether the route handler is reachable
// without burning a real authentication.
//
// All Boostr API calls in this file follow three rules — DO NOT CHANGE:
//   1. Authorization header is RAW JWT (no "Bearer " prefix)
//   2. Accept: application/vnd.boostr.public on EVERY request
//   3. /api/ios?io_number={x} returns a LIST — use [0].id
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "../_lib/boostr";

export async function POST(req: NextRequest) {
  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: `Bad JSON: ${e.message}` },
      { status: 400 }
    );
  }

  const email = payload.email ?? "";
  const password = payload.password ?? "";

  // Ping mode — doesn't hit Boostr, just confirms the route handler is alive
  if (email === "__ping__") {
    return NextResponse.json({ ok: true, message: "proxy alive" });
  }

  try {
    await authenticate(email, password);
    return NextResponse.json({ ok: true, message: "Authenticated" });
  } catch (e: any) {
    // Domain errors return 200 + ok:false so the client doesn't treat them
    // as network failures. The user sees the Boostr error message verbatim.
    return NextResponse.json({ ok: false, message: String(e?.message ?? e) });
  }
}

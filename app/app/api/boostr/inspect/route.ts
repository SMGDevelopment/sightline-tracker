// ---------------------------------------------------------------------------
// POST /api/boostr/inspect
// ---------------------------------------------------------------------------
// Debug helper — returns the raw line item JSON from Boostr so you can see
// what custom fields exist, current values, etc.
//
// SECURITY: returns full line item data which may include sensitive deal
// details. Anyone authenticated to the tracker can hit this endpoint with
// their own Boostr credentials, but the data they see is only what their
// Boostr account already has access to. If you want to remove this endpoint
// entirely in production, just delete this file.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { authenticate, findIoId, boostrRequest } from "../_lib/boostr";

export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: `Bad JSON: ${e.message}` },
      { status: 400 }
    );
  }

  const required = ["email", "password", "deal_id", "line_item_id"];
  for (const k of required) {
    if (!payload[k]) {
      return NextResponse.json(
        { ok: false, message: `Missing field: ${k}` },
        { status: 400 }
      );
    }
  }

  try {
    const jwt = await authenticate(payload.email, payload.password);
    const ioId = await findIoId(jwt, payload.deal_id);
    const data = await boostrRequest(
      "GET",
      `/api/ios/${ioId}/line_items/${payload.line_item_id}`,
      jwt
    );
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message ?? e) });
  }
}

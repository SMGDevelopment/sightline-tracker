// ---------------------------------------------------------------------------
// POST /api/boostr/set_delivery_verified
// ---------------------------------------------------------------------------
// Patches Boostr's "Delivery Verified" custom field on a single line item.
// Called from the Newsletter tab when a user sets a Date Launched.
//
// Request body:
//   {
//     email:        string  -- Boostr user email
//     password:     string  -- Boostr user password
//     deal_id:      string  -- io_number (the deal number visible in Boostr UI)
//     line_item_id: string  -- Boostr's internal line item ID
//     date_iso:     string  -- "YYYY-MM-DD"
//     initials:     string  -- optional, appended as " - XX" suffix
//   }
//
// Response:
//   200 { ok: true,  message: "Set to YYYY-MM-DD - XX" }
//   200 { ok: false, message: "<reason>" }          for domain errors
//   400 { ok: false, message: "Missing field: ..." }
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

  // Validate required fields upfront so the client gets a clean error rather
  // than a confusing Boostr 404
  const required = ["email", "password", "deal_id", "line_item_id", "date_iso"];
  for (const k of required) {
    if (!payload[k]) {
      return NextResponse.json(
        { ok: false, message: `Missing field: ${k}` },
        { status: 400 }
      );
    }
  }

  const initials = payload.initials ?? "";
  const value = initials
    ? `${payload.date_iso} - ${initials}`
    : payload.date_iso;

  try {
    // Three-step Boostr dance: authenticate, look up IO ID, update line item.
    // Boostr officially supports PUT (not PATCH) for this endpoint — per their
    // API team (May 2026), PATCH happens to work but is unsupported and may
    // break without notice. Use PUT.
    const jwt = await authenticate(payload.email, payload.password);
    const ioId = await findIoId(jwt, payload.deal_id);
    await boostrRequest(
      "PUT",
      `/api/ios/${ioId}/line_items/${payload.line_item_id}`,
      jwt,
      { line_item: { custom_fields: { "Delivery Verified": value } } }
    );
    return NextResponse.json({ ok: true, message: `Set to ${value}` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message ?? e) });
  }
}

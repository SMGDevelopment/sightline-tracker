// ---------------------------------------------------------------------------
// NOTE: API handlers have moved to Next.js Route Handlers.
//
// See: app/app/api/items/route.ts
//      app/app/api/items/[id]/route.ts
//
// All web API routes now live inside the Next.js app so they are served from
// the same CloudFront domain — no CORS, no absolute URLs.
//
// This packages/functions directory is still the right place for:
//   - Cognito Lambda triggers  (infra/auth.ts → triggers: { ... })
//   - Background / async jobs  (SQS consumers, EventBridge rules, cron jobs)
//   - Any Lambda that is NOT part of the web request path
// ---------------------------------------------------------------------------

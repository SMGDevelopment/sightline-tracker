// ---------------------------------------------------------------------------
// API — served as Next.js Route Handlers, not a separate API Gateway.
//
// Because the Next.js app and its Route Handlers are deployed behind the same
// CloudFront distribution by the SST Nextjs component, there is no CORS issue
// and the frontend can use relative paths (/api/...) for all requests.
//
// Add new endpoints in app/app/api/<resource>/route.ts.
// See CLAUDE.md → "How to add a new API endpoint".
//
// This file is intentionally empty. It is kept so the import can be added
// back if a separate API Gateway is ever needed (e.g. for a mobile client).
// ---------------------------------------------------------------------------

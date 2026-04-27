# CLAUDE.md

This file is read by Claude Code at the start of every session. It describes the project, conventions, and how to perform common tasks. Keep it up to date as the project evolves.

---

## Environment setup checks

**At the start of every session, run the following checks and stop to help the user fix anything that fails before proceeding with other work.**

### 0. App name (first-time setup only)

Read `sst.config.ts` and check whether `name` is still set to `"web-app"`:

```typescript
// sst.config.ts
app(input) {
  return {
    name: "web-app",   // ← must be changed before first deploy
```

If it is still `"web-app"`, **stop and ask the user to choose a unique app name before doing anything else.** All SST resources (CloudFormation stacks, DynamoDB tables, Lambda functions, S3 buckets) are namespaced under this name. Two projects sharing the same name in the same AWS account will conflict and overwrite each other's resources.

The name must be:
- Unique within the AWS account
- Lowercase letters, numbers, and hyphens only
- Short (it appears in every resource name)

Once the user provides a name, update `sst.config.ts`:

```typescript
name: "your-app-name",
```

Do not proceed with any `sst dev` or `sst deploy` command until this is done.

### 1. Git

```bash
git --version
```

If this fails, tell the user:
- **macOS:** `brew install git` (install Homebrew first if needed — see README)
- **Linux:** `sudo apt install git` or `sudo dnf install git`
- **Windows:** Download from https://git-scm.com

### 2. Node.js (v20 or later)

```bash
node --version
```

If this fails or the version is below 20, tell the user to install nvm and use it to install Node.js 20:

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
# restart terminal, then:
nvm install 20 && nvm use 20
```

For Windows, direct them to [nvm-windows](https://github.com/coreybutler/nvm-windows) or [nodejs.org](https://nodejs.org).

### 3. AWS credentials

```bash
aws sts get-caller-identity
```

If the AWS CLI is missing, tell the user to install it:
- **macOS:** `brew install awscli`
- **Linux:** Follow instructions at https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-linux.html
- **Windows:** Download from https://awscli.amazonaws.com/AWSCLIV2.msi

If the CLI is installed but credentials are not configured (error: `Unable to locate credentials`), ask the user which setup they have:

- **IAM user** — run `aws configure` and enter their Access Key ID, Secret Access Key, region (`us-east-1`), and output format (`json`).
- **AWS SSO** — run `aws configure sso` and follow the prompts.

Do not proceed with any `sst` commands until `aws sts get-caller-identity` returns successfully.

### 4. npm dependencies

```bash
npm install
```

Run this if `node_modules` is missing or `package-lock.json` has changed since the last install.

---

## What this project is

A full-stack web application template built with:

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) |
| Hosting | CloudFront + S3 via SST `Nextjs` component |
| Auth | Amazon Cognito + Entra ID SSO (mco-com-idp), custom PKCE flow |
| API | Next.js Route Handlers (same CloudFront domain — no CORS) |
| Database | DynamoDB (single-table) |
| Secrets | AWS SSM Parameter Store via SST secrets |
| Infrastructure | SST v3 (Ion) — TypeScript IAC, no raw CloudFormation |
| CI/CD | GitHub Actions → `sst deploy --stage production` |

---

## Repository layout

```
sst.config.ts               SST entry point — imports infra/* in dependency order.
infra/
  secrets.ts                SST secret declarations (values stored in SSM, never in code)
  auth.ts                   Cognito User Pool reference + per-stage app client
  storage.ts                DynamoDB table (single-table design)
  web.ts                    Next.js deployment (CloudFront + S3 + Lambda)
app/                        Next.js 16 application (its own npm workspace)
  app/                      App Router pages and layouts
    layout.tsx              Root layout — mounts AmplifyProvider
    page.tsx                Public home page
    auth/login/page.tsx     Triggers server-side OAuth redirect
    dashboard/page.tsx      Example authenticated page with full CRUD
    api/
      auth/
        login/route.ts      Generates PKCE verifier, redirects to Cognito hosted UI
        callback/route.ts   Exchanges OAuth code for tokens, sets cookies
        signout/route.ts    Clears session cookies
      items/route.ts        GET (list) + POST (create)
      items/[id]/route.ts   GET + PATCH (update) + DELETE
  components/
    AmplifyProvider.tsx     Configures Amplify client-side
  lib/
    amplify-config.ts       Amplify.configure() — oauth settings
    auth-server.ts          requireAuth() — reads JWT from cookie
    api.ts                  Typed fetch wrapper — uses relative /api/... paths
  proxy.ts                  Edge proxy — redirects unauthenticated requests
packages/
  functions/                Lambdas for non-HTTP work (auth triggers, background jobs)
.github/workflows/
  deploy.yml                Production deploy on push to main
```

---

## Development workflow

### Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`) with credentials for a dev account
- `npm install` at the repo root

### Start a personal dev stack

Every developer runs their own isolated SST stage. By convention use your first name or username.

```bash
npx sst dev --stage alice
```

SST will:
1. Deploy your personal CloudFormation stacks to AWS (takes ~3 min on first run)
2. Start a local Next.js dev server at http://localhost:3000
3. Print all resource URLs in the terminal

The `--stage` flag is the only thing separating your resources from a colleague's — each stage is fully independent. **Never use `--stage production` locally.**

### Environment variables

There are two env files with different scopes:

| File | Read by | Use for |
|---|---|---|
| `.env` | SST infra code only | Infra-level config (not secrets — use SST secrets instead) |
| `app/.env` | Next.js dev server | `NEXT_PUBLIC_*` browser-visible config |

Copy on first setup:
```bash
cp .env.example .env
cp app/.env.example app/.env
```

`NEXT_PUBLIC_*` variables are inlined into the browser bundle at build time — **never put secrets in them**.

---

## Secrets

> **Rule: secret values never appear in code or committed files — not in `.env`, not in `infra/`, not anywhere in the repository.**

Secrets are stored encrypted in AWS SSM Parameter Store and injected into the Lambda runtime by SST. They are never visible in CloudFormation templates, build logs, or the SST console.

### Adding a new secret

**Step 1 — Declare it in `infra/secrets.ts`:**

```typescript
export const stripeSecretKey = new sst.Secret("StripeSecretKey");
```

**Step 2 — Link it to the Next.js Lambda in `infra/web.ts`:**

```typescript
import { stripeSecretKey } from "./secrets";

export const web = new sst.aws.Nextjs("Web", {
  link: [table, stripeSecretKey],   // ← add the secret here
  ...
});
```

**Step 3 — Set the value for each stage (run once per stage, never committed):**

```bash
npx sst secret set StripeSecretKey sk_test_abc123 --stage alice
npx sst secret set StripeSecretKey sk_live_xyz789 --stage production
```

**Step 4 — Read it in any Route Handler:**

```typescript
import { Resource } from "sst";

export async function POST(request: NextRequest) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const stripe = new Stripe(Resource.StripeSecretKey.value);
  // ...
}
```

### Listing and rotating secrets

```bash
# See which secrets are set for a stage
npx sst secret list --stage alice

# Rotate a secret — redeploy is required for the new value to take effect
npx sst secret set StripeSecretKey sk_new_value --stage production
npx sst deploy --stage production
```

### Secrets in CI/CD

The GitHub Actions production deploy needs the secret values to already exist in SSM — it does **not** set them. Set production secrets once manually:

```bash
npx sst secret set StripeSecretKey sk_live_xyz789 --stage production
```

Then add `AWS_DEPLOY_ROLE_ARN` to GitHub repository secrets so the Actions workflow can authenticate. The workflow's IAM role needs `ssm:GetParameter` permission on the secret paths SST creates (`/sst/web-app/production/*`).

### What does and does not belong in SST secrets

| ✅ Use SST secrets | ❌ Do not use SST secrets |
|---|---|
| API keys (Stripe, SendGrid, etc.) | Cognito pool ID / client ID (not secret) |
| Webhook signing secrets | Public URLs and domain names |
| Database passwords (external DBs) | Feature flags |
| OAuth client secrets | Log levels / config toggles |
| Private keys / certificates | Anything already in `NEXT_PUBLIC_*` |

---

## How to add a new API endpoint

Route Handlers live in `app/app/api/` and deploy as Lambda functions on the same CloudFront domain — no CORS, no absolute URLs.

**Step 1 — Create the route file:**

```
app/app/api/orders/route.ts          → GET /api/orders, POST /api/orders
app/app/api/orders/[id]/route.ts     → GET /api/orders/:id, PATCH, DELETE
```

**Step 2 — Write the handler:**

```typescript
// app/app/api/orders/route.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth-server";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function POST(request: NextRequest) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { name } = await request.json();
  const id = crypto.randomUUID();
  const item = { pk: `USER#${userId}`, sk: `ORDER#${id}`, id, name };

  await dynamo.send(new PutCommand({ TableName: Resource.AppTable.name, Item: item }));
  return NextResponse.json(item, { status: 201 });
}
```

**Step 3 — Call it from the frontend:**

```typescript
const order = await apiClient.post("/orders", { name: "My order" });
```

No infra changes required. To make an endpoint **public**, omit the `requireAuth` call.

---

## How to add a new DynamoDB access pattern

The table uses a single-table design. All entities share one table; access patterns are modelled through key structure and GSIs.

**Key naming conventions:**

| Entity | pk | sk |
|---|---|---|
| User profile | `USER#<userId>` | `PROFILE` |
| User's item | `USER#<userId>` | `ITEM#<itemId>` |
| Order | `ORDER#<orderId>` | `ORDER#<orderId>` |
| Order line items | `ORDER#<orderId>` | `ITEM#<itemId>` |

Use `begins_with(sk, "ITEM#")` to retrieve all items of a type under a partition key.

**Adding a new GSI** (edit `infra/storage.ts`):

```typescript
globalIndexes: {
  gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  gsi2: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },  // new
},
```

---

## How to add a new authenticated page

**Step 1 — Create the page** under `app/app/`:

```
app/app/orders/page.tsx
app/app/orders/[id]/page.tsx
```

**Step 2 — Protect it** by adding the path to `config.matcher` in `app/proxy.ts`:

```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/orders/:path*"],
};
```

Unauthenticated requests to matched paths are redirected to the Cognito hosted UI. The `/auth/*` and `/api/auth/*` paths are intentionally excluded from the matcher.

---

## How to update Cognito configuration

All Cognito settings are in `infra/auth.ts`.

**Use a different pool per stage:**

```typescript
const POOL_IDS: Record<string, string> = {
  production: "us-east-1_PROD_POOL_ID",
  default:    "us-east-1_VsrpkfDO8",
};
```

**Add Cognito Groups** (for role-based access — groups are set in the shared pool, not managed by SST):

Read group membership from the JWT in a Route Handler:

```typescript
import { requireAuth } from "@/lib/auth-server";

export async function DELETE(request: NextRequest) {
  const { userId, jwt, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const groups = (jwt["cognito:groups"] ?? []) as string[];
  if (!groups.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ...
}
```

> Note: to support group claims, extend `requireAuth` in `app/lib/auth-server.ts` to also return the decoded JWT payload.

---

## Async jobs

For operations that exceed the API Gateway timeout (≈29 seconds), use the optional async job pipeline: SQS → Lambda worker → WebSocket push notification.

### Enabling the feature

Add to your root `.env`:

```bash
ENABLE_ASYNC_JOBS=true
```

Then restart your dev stack (`npx sst dev --stage <name>`). This deploys an SQS queue, an API Gateway WebSocket API, and a worker Lambda. Without this flag, none of those resources are created.

### How it works

```
Browser → POST /api/jobs { connectionId, ...input }
              ↓ { jobId }
          WebSocket ←←← Worker Lambda ←← SQS Queue
```

1. The browser opens a WebSocket connection and receives its `connectionId`.
2. The browser submits a job via `POST /api/jobs` (authenticated), including the `connectionId`.
3. The Route Handler stores the job in DynamoDB and enqueues it on SQS, returning `{ jobId }` immediately.
4. The worker Lambda picks up the message, does the work, updates job status in DynamoDB, and pushes `{ type: "job_complete", jobId, status, result }` to the browser via WebSocket.
5. If the WebSocket is gone (410), the worker silently ignores it — the browser can poll `GET /api/jobs/:id` as a fallback.

### Step 1 — Implement the worker

Edit `packages/functions/src/worker.ts` and replace `doWork()`:

```typescript
async function doWork(input: Record<string, unknown>): Promise<unknown> {
  // Your long-running logic here — can run up to 15 minutes.
  const result = await runExpensiveOperation(input);
  return result;
}
```

### Step 2 — Add a Route Handler

Copy `app/app/api/jobs/route.ts` (already in the repo) or create your own. The key fields to send to SQS are `{ jobId, userId, connectionId, ...yourInput }`.

### Step 3 — Use the hook in a component

```typescript
import { useJobNotifications } from "@/lib/useJobNotifications";

export default function MyPage() {
  const { connectionId, isReady, onJobComplete } = useJobNotifications();

  async function handleSubmit() {
    if (!isReady) return;

    const { jobId } = await apiClient.post("/jobs", {
      connectionId,
      // ...your job input
    });

    onJobComplete(jobId, (id, status, result, error) => {
      if (status === "complete") console.log("Done:", result);
      else console.error("Failed:", error);
    });
  }

  return <button disabled={!isReady} onClick={handleSubmit}>Run job</button>;
}
```

`isReady` is false until the WebSocket connection is established and the browser has received its `connectionId`. Disable submit controls until it is true.

### Polling fallback

`GET /api/jobs/:id` returns the current status from DynamoDB. Use this if the page reloads between submission and completion:

```typescript
const job = await apiClient.get(`/jobs/${jobId}`);
// { jobId, status: "pending"|"running"|"complete"|"failed", result, error }
```

### DynamoDB key conventions for jobs

| Entity | pk | sk |
|---|---|---|
| Job record | `USER#<userId>` | `JOB#<jobId>` |

---

## Observability

Tracing uses the [AWS Distro for OpenTelemetry (ADOT)](https://aws-otel.github.io/) Lambda layer. Logs and metrics use [AWS Lambda Powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

| Tool | Backend | What it gives you |
|---|---|---|
| ADOT layer | AWS X-Ray | Automatic subsegments for DynamoDB, SQS, HTTP calls, etc. |
| `logger` | CloudWatch Logs | Structured JSON logs with trace ID automatically injected |
| `metrics` | CloudWatch Metrics | Custom business metrics (EMF — no extra cost for the push) |

The ADOT layer (`AWSOpenTelemetryDistroJs`) runs the OTel Collector as a Lambda extension and auto-instruments all AWS SDK and HTTP calls. It is activated via `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument` — no code changes required to get subsegments.

### Using Powertools in a Route Handler

```typescript
import { logger, metrics } from "@/lib/powertools";
import { MetricUnit } from "@aws-lambda-powertools/metrics";

// AWS SDK clients need no special wrapping — ADOT instruments them automatically.
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(request: NextRequest) {
  try {
    const result = await dynamo.send(new QueryCommand({ ... }));
    logger.info("Listed items", { count: result.Items?.length });
    metrics.addMetric("ItemsListed", MetricUnit.Count, 1);
    return NextResponse.json(result.Items ?? []);
  } catch (error) {
    logger.error("Failed to list items", { error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();   // must be called at the end of every handler
  }
}
```

See `app/app/api/items/route.ts` for a complete example.

### Viewing traces

- **CloudWatch → X-Ray traces** — full trace timeline with subsegments; click any trace to see correlated log events
- **CloudWatch → Log Insights** — filter by `xray_trace_id` to find all logs for a specific request

### Configuration

| Variable | Set in | Value |
|---|---|---|
| `POWERTOOLS_SERVICE_NAME` | `infra/web.ts`, `infra/jobs.ts` | `<app>-<stage>` |
| `POWERTOOLS_METRICS_NAMESPACE` | both | `<app>` |
| `POWERTOOLS_LOG_LEVEL` | both | `DEBUG` (non-prod) / `INFO` (production) |
| `AWS_LAMBDA_EXEC_WRAPPER` | both | `/opt/otel-instrument` |
| `OTEL_SERVICE_NAME` | both | `<app>-<stage>` |

### Updating the ADOT layer

The layer ARN is pinned in `infra/web.ts` and `infra/jobs.ts`. To update:
1. Find the latest ARN at the [ADOT Lambda layer releases](https://github.com/aws-observability/aws-otel-lambda/releases)
2. Update `ADOT_LAYER_ARN` in both files (they must stay in sync)
3. Note: ARNs are region-specific — update if deploying outside `us-east-1`

---

## Deployment

### Personal stage
```bash
npx sst deploy --stage alice
```

### Production
Production deploys happen automatically via GitHub Actions on push to `main`. See `.github/workflows/deploy.yml`.

Manual production deploy (use sparingly):
```bash
npx sst deploy --stage production
```

### Tear down a personal stack
```bash
npx sst remove --stage alice
```

Production has `protect: true` and `removal: "retain"` — it cannot be torn down this way.

---

## Common `sst` commands

| Command | What it does |
|---|---|
| `npx sst dev --stage <name>` | Start local dev |
| `npx sst deploy --stage <name>` | Deploy (or update) a stage |
| `npx sst remove --stage <name>` | Tear down a non-production stage |
| `npx sst secret set <Key> <val> --stage <name>` | Set an encrypted secret |
| `npx sst secret list --stage <name>` | List secrets for a stage |
| `npx sst console` | Open the SST console (logs, DynamoDB browser, etc.) |
| `npx sst diff --stage production` | Preview infra changes before deploying |

---

## Key conventions

- **Secrets live in SST, nowhere else.** No secret values in code, `.env` files, or `environment:` blocks.
- **`NEXT_PUBLIC_*` vars are public.** They are inlined into the browser bundle — treat them as non-confidential config.
- **One table per stage.** Dev stages are completely isolated from production data.
- **Route Handlers are thin.** Business logic lives in `packages/core/`; handlers do auth, input parsing, and response shaping only.
- **No hardcoded resource names.** Always use `Resource.<Name>` from the `sst` package — never string-literal ARNs or table names.
- **All Route Handlers require auth by default.** Call `requireAuth(request)` at the top. Skip it only for genuinely public endpoints.
- **`infra/` files import in dependency order.** `sst.config.ts` defines the sequence: `secrets → auth → storage → jobs → web`.

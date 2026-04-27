// ---------------------------------------------------------------------------
// Async Jobs — opt-in feature.
// ---------------------------------------------------------------------------
// Set ENABLE_ASYNC_JOBS=true in root .env to deploy these resources:
//   • SQS queue for job submissions
//   • API Gateway WebSocket API for push notifications to the browser
//   • $connect / $disconnect route handlers
//   • Worker Lambda subscribed to the queue
//
// Without the flag nothing here is created and no AWS cost is incurred.
//
// See CLAUDE.md → "Async jobs" for the full usage guide.
// ---------------------------------------------------------------------------

import { table } from "./storage";

// Keep in sync with infra/web.ts — same layer, same region constraint.
const ADOT_LAYER_ARN = "arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroJs:12";

export const JOBS_ENABLED = process.env.ENABLE_ASYNC_JOBS === "true";

let queue: sst.aws.Queue | undefined;
let websocket: sst.aws.ApiGatewayWebSocket | undefined;

if (JOBS_ENABLED) {
  queue = new sst.aws.Queue("JobQueue", {
    // Visibility timeout must be >= your worker Lambda's maximum runtime.
    // Lambda hard limit is 15 minutes — match that here.
    visibilityTimeout: "15 minutes",
    transform: {
      queue: (args) => {
        args.tags = {
          ...((args.tags as Record<string, string>) ?? {}),
          Name: $interpolate`${$app.name}-${$app.stage}-job-queue`,
        };
      },
    },
  });

  websocket = new sst.aws.ApiGatewayWebSocket("JobsWs", {
    transform: {
      api: (args) => {
        args.description = $interpolate`${$app.name} (${$app.stage}) WebSocket API`;
      },
    },
  });

  websocket.route("$connect", {
    handler: "packages/functions/src/ws-connect.handler",
  });

  websocket.route("$disconnect", {
    handler: "packages/functions/src/ws-disconnect.handler",
  });

  // $default: browser sends an identify message on open; this handler replies
  // with the connectionId. Runs after $connect so PostToConnection is safe.
  // Grant execute-api:ManageConnections explicitly — link alone is unreliable
  // inside websocket.route().
  websocket.route("$default", {
    handler: "packages/functions/src/ws-identify.handler",
    permissions: [
      {
        actions: ["execute-api:ManageConnections"],
        resources: [
          $interpolate`${websocket.nodes.api.executionArn}/*/*/@connections/*`,
        ],
      },
    ],
  });

  // Worker: replace the placeholder in packages/functions/src/worker.ts with
  // your actual long-running logic.
  queue.subscribe({
    handler: "packages/functions/src/worker.handler",
    link: [table],
    timeout: "15 minutes",
    layers: [ADOT_LAYER_ARN],
    permissions: [
      {
        actions: ["execute-api:ManageConnections"],
        resources: [
          $interpolate`${websocket.nodes.api.executionArn}/*/*/@connections/*`,
        ],
      },
      {
        actions: [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
        ],
        resources: ["*"],
      },
    ],
    environment: {
      WS_MANAGEMENT_ENDPOINT: websocket.managementEndpoint,
      POWERTOOLS_SERVICE_NAME: $interpolate`${$app.name}-${$app.stage}-worker`,
      POWERTOOLS_METRICS_NAMESPACE: $app.name,
      POWERTOOLS_LOG_LEVEL: $app.stage === "production" ? "INFO" : "DEBUG",
      AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
      OTEL_SERVICE_NAME: $interpolate`${$app.name}-${$app.stage}-worker`,
    },
    transform: {
      function: (args) => {
        args.tracingConfig = { mode: "Active" };
      },
    },
  });
}

export { queue, websocket };

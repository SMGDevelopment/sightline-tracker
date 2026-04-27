// ---------------------------------------------------------------------------
// Next.js on AWS (CloudFront + S3 + Lambda)
// ---------------------------------------------------------------------------
// SST's Nextjs component deploys the entire app — pages, server components,
// and Route Handlers — behind a single CloudFront distribution.
//
// Because the API lives at /api/* on the same domain, there is no CORS and
// the frontend uses relative URLs. No separate API Gateway is needed.
//
// SST injects environment variables into the Next.js Lambda at runtime.
// NEXT_PUBLIC_ vars are also inlined at build time and visible in the browser.
// Never put secrets in NEXT_PUBLIC_ variables.
// ---------------------------------------------------------------------------

import { userPoolId, userPoolClient } from "./auth";
import { table } from "./storage";
//import { queue, websocket } from "./jobs";
// import { exampleApiKey } from "./secrets";  // uncomment when adding secrets

// ADOT Lambda layer — runs the OTel Collector as a Lambda extension.
// The collector receives OTLP spans on localhost:4318 and forwards them to X-Ray.
// AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument activates auto-instrumentation.
// Update the version suffix when AWS publishes new releases.
// Layer ARNs are region-specific; update if deploying outside us-east-1.
const ADOT_LAYER_ARN = "arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroJs:12";

export const web = new sst.aws.Nextjs("Web", {
  path: "app",

  // Add secrets to this array so Route Handlers can access them via Resource.<Name>.value
  // Example: link: [table, exampleApiKey]
  link: [
    table,
 //   ...(queue ? [queue] : []),
  //  ...(websocket ? [websocket] : []),
  ],

  server: {
    layers: [ADOT_LAYER_ARN],
  },

  environment: {
    NEXT_PUBLIC_AWS_REGION: aws.getRegionOutput().name,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: userPoolId,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: userPoolClient.id,
    // The Cognito hosted UI domain — find it in the AWS Console under
    // Cognito → User Pool → App integration → Domain.
    // Format (without https://): <prefix>.auth.<region>.amazoncognito.com
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "",
    // Injected automatically when ENABLE_ASYNC_JOBS=true — used by useJobNotifications().
   // ...(websocket ? { NEXT_PUBLIC_WS_URL: websocket.url } : {}),

    // Powertools — read by app/lib/powertools.ts
    POWERTOOLS_SERVICE_NAME: $interpolate`${$app.name}-${$app.stage}`,
    POWERTOOLS_METRICS_NAMESPACE: $app.name,
    POWERTOOLS_LOG_LEVEL: $app.stage === "production" ? "INFO" : "DEBUG",

    AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
    OTEL_SERVICE_NAME: $interpolate`${$app.name}-${$app.stage}`,

  },

  permissions: [
    {
      // Required for the OTel SDK / ADOT collector to send spans to X-Ray.
      actions: [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords",
        "xray:GetSamplingRules",
        "xray:GetSamplingTargets",
      ],
      resources: ["*"],
    },
  ],

  transform: {
    cdn: (args) => {
      args.comment = $interpolate`${$app.name} (${$app.stage})`;
    },
    server: (args) => {
      args.description = $interpolate`${$app.name} (${$app.stage}) Next.js server`;
      // Enable X-Ray active tracing — Lambda runtime creates the root segment
      // and injects _X_AMZN_TRACE_ID, which the OTel AWSXRayPropagator reads.
      args.transform = {
        function: (fnArgs) => {
          fnArgs.tracingConfig = { mode: "Active" };
        },
      };
    },
    imageOptimizer: (args) => {
      args.description = $interpolate`${$app.name} (${$app.stage}) Next.js image optimization`;
    },
  },

  // Production uses a fixed domain. Other stages can optionally set DEPLOY_DOMAIN.
  // Requires a Route 53 hosted zone for militarytimes.com in the AWS account.
  ...($app.stage === "production"
    ? { domain: { name: "sl-tracker.militarytimes.com", dns: sst.aws.dns() } }
    : process.env.DEPLOY_DOMAIN
      ? { domain: { name: process.env.DEPLOY_DOMAIN, dns: sst.aws.dns() } }
      : {}),
});

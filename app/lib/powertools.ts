// ---------------------------------------------------------------------------
// Observability — AWS Lambda Powertools
// ---------------------------------------------------------------------------
// Two module-level singletons shared across all requests in a Lambda instance.
// Powertools reads configuration from environment variables set in infra/web.ts:
//   POWERTOOLS_SERVICE_NAME        → service label on all logs and metrics
//   POWERTOOLS_METRICS_NAMESPACE   → CloudWatch metrics namespace
//   POWERTOOLS_LOG_LEVEL           → log verbosity (DEBUG in dev, INFO in prod)
//
// Tracing is handled by OpenTelemetry (see lib/otel.ts), not Powertools.
// AWS SDK calls appear as X-Ray subsegments automatically via
// @opentelemetry/instrumentation-aws-sdk — no per-client wrapping needed.
//
// Usage in a Route Handler:
//
//   import { logger, metrics } from "@/lib/powertools";
//   import { MetricUnit } from "@aws-lambda-powertools/metrics";
//
//   export async function GET(request: NextRequest) {
//     try {
//       logger.info("Listed items", { count: result.Items?.length });
//       metrics.addMetric("ItemsListed", MetricUnit.Count, 1);
//       return NextResponse.json(result.Items ?? []);
//     } catch (error) {
//       logger.error("Failed to list items", { error });
//       throw error;
//     } finally {
//       metrics.publishStoredMetrics();   // flush EMF metrics to CloudWatch
//     }
//   }
// ---------------------------------------------------------------------------

import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

// Powertools reads POWERTOOLS_SERVICE_NAME and POWERTOOLS_METRICS_NAMESPACE from env.
export const logger = new Logger();
export const metrics = new Metrics();

// Called server-side for every unhandled request error (pages, route handlers, etc.).
// Logs the error via Powertools so the CloudWatch log entry includes the X-Ray trace ID
// alongside the error digest shown on the client error page — one search finds both.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger, metrics } = await import("./lib/powertools");
  const { MetricUnit } = await import("@aws-lambda-powertools/metrics");
  const error = err as Error & { digest?: string };

  // _X_AMZN_TRACE_ID is set by the Lambda runtime for every invocation.
  // Parse just the Root portion: "Root=1-abc-def;Parent=...;Sampled=1" → "1-abc-def"
  const rawTrace = process.env._X_AMZN_TRACE_ID ?? "";
  const traceId = rawTrace.match(/Root=([^;]+)/)?.[1];

  logger.error("Unhandled request error", {
    digest: error.digest,
    traceId,
    error: { message: error.message, stack: error.stack },
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });

  metrics.addDimension("routeType", context.routeType);
  metrics.addMetric("Fault", MetricUnit.Count, 1);
  metrics.publishStoredMetrics();
}

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import type { SQSHandler } from "aws-lambda";
import { Resource } from "sst";

// Injected by infra/jobs.ts — avoids relying on link for ManageConnections.
const WS_ENDPOINT = process.env.WS_MANAGEMENT_ENDPOINT!;

const logger = new Logger();
const metrics = new Metrics();

// ---------------------------------------------------------------------------
// Worker Lambda — replace doWork() with your actual long-running logic.
//
// Each SQS message is a job submitted via POST /api/jobs. The worker:
//   1. Marks the job "running" in DynamoDB
//   2. Calls doWork() with the job input — implement your logic there
//   3. Marks the job "complete" or "failed" in DynamoDB
//   4. Pushes the result to the browser via WebSocket
//      (410 Gone is silently ignored — browser may have disconnected)
//
// SQS will retry failed messages up to the queue's maxReceiveCount, then
// route them to the dead-letter queue.
// ---------------------------------------------------------------------------

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { jobId, userId, connectionId, ...input } = JSON.parse(record.body) as {
      jobId: string;
      userId: string;
      connectionId: string;
      [key: string]: unknown;
    };

    logger.appendKeys({ jobId, userId });

    const pk = `USER#${userId}`;
    const sk = `JOB#${jobId}`;

    logger.info("Job received", { input });
    await setStatus(pk, sk, "running");

    try {
      logger.info("Job running");
      const result = await doWork(input);
      await setStatus(pk, sk, "complete", { result });
      await notify(connectionId, { type: "job_complete", jobId, status: "complete", result });
      logger.info("Job complete", { result });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await setStatus(pk, sk, "failed", { error });
      await notify(connectionId, { type: "job_complete", jobId, status: "failed", error });
      metrics.addMetric("Fault", MetricUnit.Count, 1);
      metrics.publishStoredMetrics();
      logger.error("Job failed", { error });
      throw err; // re-throw so SQS can retry / route to DLQ
    } finally {
      logger.removeKeys(["jobId", "userId"]);
    }
  }
};

// ---------------------------------------------------------------------------
// Replace this with your actual long-running work.
// Return any JSON-serialisable value as the job result.
// ---------------------------------------------------------------------------
async function doWork(_input: Record<string, unknown>): Promise<unknown> {
  // Example: simulate a slow operation
  await new Promise((r) => setTimeout(r, 2000));
  return { message: "done" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setStatus(
  pk: string,
  sk: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const sets = ["#status = :status", "updatedAt = :now"];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":now": new Date().toISOString(),
  };

  for (const [k, v] of Object.entries(extra)) {
    sets.push(`#${k} = :${k}`);
    names[`#${k}`] = k;
    values[`:${k}`] = v;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: Resource.AppTable.name,
      Key: { pk, sk },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

async function notify(connectionId: string, data: unknown) {
  const client = new ApiGatewayManagementApiClient({
    endpoint: WS_ENDPOINT,
  });
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(data),
      })
    );
  } catch (err: unknown) {
    // 410 Gone — browser disconnected before the job finished. Safe to ignore.
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status !== 410) throw err;
  }
}

// POST /api/jobs — enqueue a long-running job and return its ID immediately.
//
// Requires ENABLE_ASYNC_JOBS=true and the queue to be deployed.
// See CLAUDE.md → "Async jobs" for setup instructions.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth-server";
import { logger, metrics } from "@/lib/powertools";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

export async function POST(request: NextRequest) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  // connectionId comes from the useJobNotifications() hook in the browser.
  // It is used by the worker to push the completion notification.
  const { connectionId, ...input } = await request.json();

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Store the job record so the client can poll status as a fallback.
    await dynamo.send(
      new PutCommand({
        TableName: Resource.AppTable.name,
        Item: {
          pk: `USER#${userId}`,
          sk: `JOB#${jobId}`,
          jobId,
          userId,
          connectionId,
          status: "pending",
          input,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: Resource.JobQueue.url,
        MessageBody: JSON.stringify({ jobId, userId, connectionId, ...input }),
      })
    );

    logger.info("Job enqueued", { userId, jobId, connectionId });
    metrics.addMetric("JobEnqueued", MetricUnit.Count, 1);
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    logger.error("Failed to enqueue job", { userId, jobId, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

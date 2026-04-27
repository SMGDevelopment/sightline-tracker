// GET /api/jobs/:id — poll job status.
//
// Useful as a fallback if the WebSocket connection is lost before the worker
// finishes. The browser can poll this until status is "complete" or "failed".
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth-server";
import { logger, metrics } from "@/lib/powertools";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { Item: job } = await dynamo.send(
      new GetCommand({
        TableName: Resource.AppTable.name,
        Key: { pk: `USER#${userId}`, sk: `JOB#${id}` },
      })
    );

    if (!job) {
      logger.warn("Job not found", { userId, jobId: id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logger.info("Polled job status", { userId, jobId: id, status: job.status });
    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    logger.error("Failed to fetch job", { userId, jobId: id, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

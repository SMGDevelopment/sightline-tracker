import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth-server";
import { logger, metrics } from "@/lib/powertools";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET /api/items
export async function GET(request: NextRequest) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: Resource.AppTable.name,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":prefix": "ITEM#" },
      }),
    );

    const items = result.Items ?? [];
    logger.info("Listed items", { userId, count: items.length });
    metrics.addMetric("ItemsListed", MetricUnit.Count, 1);
    return NextResponse.json(items);
  } catch (error) {
    logger.error("Failed to list items", { userId, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

// POST /api/items
export async function POST(request: NextRequest) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { name } = (await request.json()) as { name: string };
  const id = crypto.randomUUID();

  const item = {
    pk: `USER#${userId}`,
    sk: `ITEM#${id}`,
    id,
    name,
    createdAt: new Date().toISOString(),
  };

  try {
    await dynamo.send(new PutCommand({ TableName: Resource.AppTable.name, Item: item }));
    logger.info("Created item", { userId, itemId: id });
    metrics.addMetric("ItemCreated", MetricUnit.Count, 1);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    logger.error("Failed to create item", { userId, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

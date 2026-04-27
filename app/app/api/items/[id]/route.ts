import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { NextRequest, NextResponse } from "next/server";
import { Resource } from "sst";
import { requireAuth } from "@/lib/auth-server";
import { logger, metrics } from "@/lib/powertools";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET /api/items/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const result = await dynamo.send(
      new GetCommand({
        TableName: Resource.AppTable.name,
        Key: { pk: `USER#${userId}`, sk: `ITEM#${id}` },
      }),
    );

    if (!result.Item) {
      logger.warn("Item not found", { userId, itemId: id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logger.info("Fetched item", { userId, itemId: id });
    return NextResponse.json(result.Item);
  } catch (error) {
    logger.error("Failed to fetch item", { userId, itemId: id, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

// PATCH /api/items/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const { name } = (await request.json()) as { name: string };

  try {
    const result = await dynamo.send(
      new UpdateCommand({
        TableName: Resource.AppTable.name,
        Key: { pk: `USER#${userId}`, sk: `ITEM#${id}` },
        UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":name": name,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );

    logger.info("Updated item", { userId, itemId: id });
    metrics.addMetric("ItemUpdated", MetricUnit.Count, 1);
    return NextResponse.json(result.Attributes);
  } catch (error) {
    logger.error("Failed to update item", { userId, itemId: id, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

// DELETE /api/items/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, errorResponse } = requireAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    await dynamo.send(
      new DeleteCommand({
        TableName: Resource.AppTable.name,
        Key: { pk: `USER#${userId}`, sk: `ITEM#${id}` },
      }),
    );

    logger.info("Deleted item", { userId, itemId: id });
    metrics.addMetric("ItemDeleted", MetricUnit.Count, 1);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Failed to delete item", { userId, itemId: id, error });
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
}

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

// $default handler — receives the browser's first message and replies with
// the server-assigned connectionId. Called after $connect so the connection
// is fully established and PostToConnection is safe.
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;

  const client = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: "connected", connectionId }),
    })
  );

  return { statusCode: 200 };
};

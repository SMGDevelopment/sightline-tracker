import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

// $connect handler — accepts the connection. The connectionId is sent back to
// the browser by the $default handler (ws-identify) after the first message,
// because PostToConnection is not safe to call during $connect (the connection
// isn't fully established yet at that point).
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (_event) => {
  return { statusCode: 200 };
};

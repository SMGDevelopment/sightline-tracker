import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

// $disconnect handler — nothing to clean up. The connectionId was passed to
// the job record by the browser when the job was submitted. Stale connections
// are handled gracefully in the worker: 410 Gone is silently ignored.
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (_event) => {
  return { statusCode: 200 };
};

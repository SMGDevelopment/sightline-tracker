// ---------------------------------------------------------------------------
// DynamoDB — Single-Table Design
// ---------------------------------------------------------------------------
// One table per stage (dev stages are isolated from production).
// The table uses a composite primary key (pk + sk) and one GSI.
//
// Access pattern conventions:
//   pk format:  ENTITY_TYPE#id       e.g. USER#abc123
//   sk format:  ENTITY_TYPE#id       e.g. ITEM#xyz789
//  gsi1pk:     anything you need for a secondary access pattern
//  gsi1sk:     sort key for that pattern
//
// Add more GSIs here as new access patterns are needed.
// ---------------------------------------------------------------------------

export const table = new sst.aws.Dynamo("AppTable", {
  fields: {
    pk: "string",
    sk: "string",
    gsi1pk: "string",
    gsi1sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
  // Point-in-time recovery is enabled automatically for the production stage
  // via the `protect` flag in sst.config.ts.
});

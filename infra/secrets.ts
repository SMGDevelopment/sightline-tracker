// ---------------------------------------------------------------------------
// Secrets — encrypted at rest in AWS SSM Parameter Store.
//
// NEVER put secret values in code, .env files, or environment variables
// passed via infra/web.ts. Use SST secrets instead.
//
// To set a secret for your stage:
//   npx sst secret set <Name> <value> --stage <yourname>
//
// To set a secret for production:
//   npx sst secret set <Name> <value> --stage production
//
// Secrets must be set before deploying — SST will error if a linked secret
// has no value for the target stage.
//
// To add a new secret:
//   1. Declare it here with `new sst.Secret("MySecret")`
//   2. Add it to the `link` array in infra/web.ts
//   3. Run `npx sst secret set MySecret <value> --stage <yourname>`
//   4. Access in any Route Handler via `Resource.MySecret.value`
// ---------------------------------------------------------------------------

// Example: a third-party API key. Uncomment and rename to match your service.
// export const exampleApiKey = new sst.Secret("ExampleApiKey");

export {};

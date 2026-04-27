/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "web-app",
      // Production resources are retained on `sst remove` to prevent accidental data loss.
      // Personal dev stacks are fully removed.
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: {
        aws: {
          // Set a default region; override via AWS_REGION env var or provider config.
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    // Import order matters — later modules can reference earlier exports.
    await import("./infra/secrets");
    await import("./infra/auth");
    await import("./infra/storage");
    await import("./infra/jobs");   // optional — gated by ENABLE_ASYNC_JOBS in root .env
    const { web } = await import("./infra/web");

    return {
      url: $dev ? "http://localhost:3000" : web.url,
    };
  },
});

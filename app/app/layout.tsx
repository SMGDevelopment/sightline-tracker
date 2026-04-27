import type { Metadata } from "next";
import { AmplifyProvider } from "@/components/AmplifyProvider";
import { TraceProvider } from "@/components/TraceProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web App",
  description: "Built with Next.js + SST + AWS",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Parse the trace ID from the Lambda env var so the error boundary can link
  // directly to the X-Ray trace without a round-trip API call. Layout and page
  // run in the same Lambda invocation, so the trace ID is the same.
  // Format: "Root=1-abc-def;Parent=...;Sampled=1" → "1-abc-def"
  const rawTrace = process.env._X_AMZN_TRACE_ID ?? "";
  const traceId = rawTrace.match(/Root=([^;]+)/)?.[1] ?? null;

  return (
    <html lang="en">
      <body>
        <TraceProvider traceId={traceId}>
          <AmplifyProvider>{children}</AmplifyProvider>
        </TraceProvider>
      </body>
    </html>
  );
}

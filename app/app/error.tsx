"use client";

import { useTraceId } from "@/components/TraceProvider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const traceId = useTraceId();
  const region = process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1";
  const traceUrl = traceId
    ? `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#xray:traces/${traceId}`
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-red-100 bg-red-50 p-8 text-center">
        <h1 className="text-xl font-semibold text-red-800">Something went wrong</h1>
        <p className="mt-2 text-sm text-red-600">
          An unexpected error occurred. Try again, or contact support if it persists.
        </p>

        {error.digest && (
          <div className="mt-6 rounded-md bg-white px-4 py-3 text-left shadow-sm ring-1 ring-red-100">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Reference ID
            </p>
            <p className="mt-1 font-mono text-sm text-gray-700 break-all">{error.digest}</p>

            {traceUrl && (
              <a
                href={traceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-blue-600 hover:underline"
              >
                View X-Ray trace →
              </a>
            )}
          </div>
        )}

        <button
          onClick={reset}
          className="mt-6 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

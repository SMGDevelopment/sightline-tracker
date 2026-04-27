"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type JobStatus = "complete" | "failed";
type JobCompleteCallback = (
  jobId: string,
  status: JobStatus,
  result?: unknown,
  error?: string
) => void;

// ---------------------------------------------------------------------------
// useJobNotifications
//
// Opens a WebSocket connection to the Jobs API and returns:
//   connectionId  — pass this to POST /api/jobs so the worker knows where to
//                   send the completion notification.
//   isReady       — true once the connection ID is received from the server.
//   onJobComplete — register a one-time callback for a specific job ID.
//
// Usage:
//   const { connectionId, isReady, onJobComplete } = useJobNotifications();
//
//   async function submitJob() {
//     const { jobId } = await apiClient.post("/jobs", { connectionId, ...input });
//     onJobComplete(jobId, (id, status, result, error) => {
//       // handle completion
//     });
//   }
//
// Requires ENABLE_ASYNC_JOBS=true — NEXT_PUBLIC_WS_URL must be set.
// If the env var is absent the hook is a no-op (isReady stays false).
// ---------------------------------------------------------------------------

export function useJobNotifications() {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const callbacksRef = useRef<Map<string, JobCompleteCallback>>(new Map());

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!url) return;

    const ws = new WebSocket(url);

    // Trigger the $default handler which replies with our connectionId.
    // We can't receive the connectionId in $connect because PostToConnection
    // is not safe to call before the connection is fully established.
    ws.onopen = () => ws.send(JSON.stringify({ action: "identify" }));

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as {
        type: string;
        connectionId?: string;
        jobId?: string;
        status?: JobStatus;
        result?: unknown;
        error?: string;
      };

      if (msg.type === "connected" && msg.connectionId) {
        setConnectionId(msg.connectionId);
      } else if (msg.type === "job_complete" && msg.jobId) {
        const cb = callbacksRef.current.get(msg.jobId);
        if (cb) {
          cb(msg.jobId, msg.status ?? "failed", msg.result, msg.error);
          callbacksRef.current.delete(msg.jobId);
        }
      }
    };

    ws.onclose = () => setConnectionId(null);

    return () => ws.close();
  }, []);

  const onJobComplete = useCallback(
    (jobId: string, callback: JobCompleteCallback) => {
      callbacksRef.current.set(jobId, callback);
    },
    []
  );

  return { connectionId, isReady: connectionId !== null, onJobComplete };
}

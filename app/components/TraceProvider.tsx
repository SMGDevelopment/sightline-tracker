"use client";

import { createContext, useContext } from "react";

const TraceContext = createContext<string | null>(null);

export function TraceProvider({
  traceId,
  children,
}: {
  traceId: string | null;
  children: React.ReactNode;
}) {
  return <TraceContext.Provider value={traceId}>{children}</TraceContext.Provider>;
}

export function useTraceId() {
  return useContext(TraceContext);
}

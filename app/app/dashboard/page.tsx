"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useJobNotifications } from "@/lib/useJobNotifications";

interface Item {
  id: string;
  pk: string;
  sk: string;
  name: string;
  createdAt: string;
}

type JobState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "running"; jobId: string }
  | { status: "complete"; result: unknown }
  | { status: "failed"; error: string };

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { connectionId, isReady, onJobComplete } = useJobNotifications();
  const [job, setJob] = useState<JobState>({ status: "idle" });
  const [apiError, setApiError] = useState<{ status: number; body: string } | null>(null);

  useEffect(() => {
    apiClient.get<Item[]>("/items")
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const item = await apiClient.post<Item>("/items", { name: newName.trim() });
      setItems((prev) => [item, ...prev]);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) return;
    const updated = await apiClient.patch<Item>(`/items/${id}`, { name: editingName.trim() });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await apiClient.delete(`/items/${id}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleRunJob() {
    if (!isReady || !connectionId) return;
    setJob({ status: "running", jobId: "" });
    const { jobId } = await apiClient.post<{ jobId: string }>("/jobs", {
      connectionId,
      description: "example background task",
    });
    setJob({ status: "running", jobId });
    onJobComplete(jobId, (_id, status, result, error) => {
      if (status === "complete") setJob({ status: "complete", result });
      else setJob({ status: "failed", error: error ?? "unknown error" });
    });
  }

  async function handleTestApiError() {
    setApiError(null);
    const res = await fetch("/api/test-error");
    const body = await res.text();
    setApiError({ status: res.status, body });
  }

  async function handleSignOut() {
    const res = await fetch("/api/auth/signout", { method: "POST" });
    const { logoutUrl } = await res.json();
    window.location.href = logoutUrl;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestApiError}
            className="rounded-md border px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-50"
          >
            Test API error
          </button>
          <a
            href="/test-error"
            className="rounded-md border px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-50"
          >
            Test error page
          </a>
          <button
            onClick={handleSignOut}
            className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* API error test result */}
      {apiError && (
        <div className="mt-4 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-red-800">API responded {apiError.status}</span>
            <button onClick={() => setApiError(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <pre className="mt-2 overflow-auto text-xs text-red-700 whitespace-pre-wrap">{apiError.body}</pre>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mt-8 flex gap-2">
        <input
          type="text"
          placeholder="New item name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add"}
        </button>
      </form>

      {/* Async job example — only visible when ENABLE_ASYNC_JOBS=true */}
      {process.env.NEXT_PUBLIC_WS_URL && (
        <section className="mt-10 rounded-md border p-5">
          <h2 className="text-sm font-semibold text-gray-700">Background job example</h2>
          <p className="mt-1 text-xs text-gray-500">
            Submits a job to SQS and waits for a WebSocket push notification on completion.
          </p>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleRunJob}
              disabled={!isReady || job.status === "running"}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {job.status === "running" ? "Running…" : "Run job"}
            </button>

            {!isReady && (
              <span className="text-xs text-gray-400">Connecting to WebSocket…</span>
            )}

            {job.status === "running" && (
              <span className="text-xs text-gray-500">
                Waiting for result
                {job.jobId && (
                  <span className="ml-1 font-mono text-gray-400">({job.jobId.slice(0, 8)}…)</span>
                )}
              </span>
            )}

            {job.status === "complete" && (
              <span className="text-xs text-green-700">
                Done: <span className="font-mono">{JSON.stringify(job.result)}</span>
              </span>
            )}

            {job.status === "failed" && (
              <span className="text-xs text-red-600">Failed: {job.error}</span>
            )}
          </div>

          {(job.status === "complete" || job.status === "failed") && (
            <button
              onClick={() => setJob({ status: "idle" })}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              Reset
            </button>
          )}
        </section>
      )}

      {/* Item list */}
      <section className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No items yet. Add one above.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === item.id ? (
                  <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(item.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleUpdate(item.id)}
                    className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="flex-1 text-sm">{item.name}</span>
                )}

                <div className="flex gap-2">
                  {editingId === item.id ? (
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

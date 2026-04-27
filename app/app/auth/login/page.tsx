"use client";

import { useEffect } from "react";

export default function AuthLoginPage() {
  useEffect(() => {
    window.location.href = "/api/auth/login";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting…</p>
    </div>
  );
}

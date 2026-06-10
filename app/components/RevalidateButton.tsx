"use client";

import { useState } from "react";

import { fetchWithAdminRetry } from "../lib/admin-client";
type Props = {
  path?: string;
  label?: string;
};

export default function RevalidateButton({ path, label = "Atualizar dados" }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const url = path
        ? `/api/revalidate?path=${encodeURIComponent(path)}`
        : "/api/revalidate";
      const res = await fetchWithAdminRetry(url, { method: "POST" });
      if (res.ok) {
        setStatus("done");
        // Reload page after short delay to show updated data
        setTimeout(() => window.location.reload(), 800);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading" || status === "done"}
      className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
    >
      {status === "loading" && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      )}
      {status === "done" && <span className="text-emerald-500">✓</span>}
      {status === "error" && <span className="text-red-500">✗</span>}
      {status === "idle" && (
        <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
      {status === "loading" ? "Atualizando..." : status === "done" ? "Atualizado!" : status === "error" ? "Erro — tente novamente" : label}
    </button>
  );
}

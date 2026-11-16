"use client";

import { useState } from "react";

import { fetchWithAdminRetry } from "../lib/admin-client";
type Props = {
  path?: string;
  label?: string;
  /** Mantido por compatibilidade; o botão é sempre redondo, só com ícone. */
  variant?: "icon";
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

  const statusLabel =
      status === "loading" ? "Atualizando dados" : status === "done" ? "Dados atualizados" : status === "error" ? "Erro ao atualizar — tente novamente" : label;
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading" || status === "done"}
        aria-label={statusLabel}
        title={statusLabel}
        className={`ui-icon-btn${status === "loading" ? " ui-icon-btn--spin" : ""}`}
        style={status === "error" ? { color: "#ff8a7a" } : status === "done" ? { color: "var(--ui-good)" } : undefined}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {status === "done" ? <path d="M5 12l5 5 9-10" /> : (<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>)}
        </svg>
      </button>
    );
}

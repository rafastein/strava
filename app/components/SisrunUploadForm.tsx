"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchWithAdminRetry } from "../lib/admin-client";
export default function SisrunUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setStatus("Selecione um arquivo .xls ou .xlsx.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Enviando planilha...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithAdminRetry("/api/sisrun/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Falha ao processar a planilha.");
        return;
      }

      setStatus("Planilha processada com sucesso.");
      router.refresh();
    } catch {
      setStatus("Erro ao enviar a planilha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ui-stack">
      <p>Envie a planilha exportada do SisRUN (.xls ou .xlsx) para atualizar o planejamento semanal.</p>

      <input
        ref={inputRef}
        id="sisrun-file"
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          setFile(selected);
          setStatus("");
        }}
        className="sr-only"
      />

      <div className="hoje-notice">
        <label htmlFor="sisrun-file" className="ui-muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>
          {file ? file.name : "Nenhum arquivo escolhido"}
        </label>
        <button type="button" onClick={() => inputRef.current?.click()} className="ui-btn ui-btn--ghost" style={{ cursor: "pointer", flexShrink: 0 }}>
          Escolher arquivo
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="ui-btn"
        style={{ border: 0, opacity: loading ? 0.5 : 1, cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? "Processando…" : "Enviar planilha"}
      </button>
      {status ? <p role="status" className="ui-muted" style={{ fontSize: 14 }}>{status}</p> : null}
    </form>
  );
}

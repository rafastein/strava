"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

      const res = await fetch("/api/sisrun/upload", {
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
    <form onSubmit={handleSubmit} className="ba-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="ba-eyebrow">Upload</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#fff", marginTop: 4 }}>
          Atualizar SisRUN
        </h2>
        <p className="ba-muted" style={{ marginTop: ".4rem" }}>
          Envie a planilha exportada para atualizar o planejamento semanal.
        </p>
      </div>

      <div className="ba-card-soft" style={{ padding: "1rem" }}>
        <p className="ba-label" style={{ marginBottom: ".75rem" }}>Arquivo da planilha</p>

        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            setStatus("");
          }}
          className="sr-only"
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 14px" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file ? file.name : "Nenhum arquivo escolhido"}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ba-pill ba-pill-dark"
            style={{ flexShrink: 0, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}
          >
            Escolher arquivo
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={loading}
          className="ba-pill ba-pill-orange"
          style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", opacity: loading ? .5 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Processando..." : "Enviar planilha"}
        </button>
        {status && <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>{status}</p>}
      </div>
    </form>
  );
}

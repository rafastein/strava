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
    <form onSubmit={handleSubmit} className="ba-card p-4 md:p-5">
      <div>
        <p className="ba-eyebrow">Upload</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Atualizar SisRUN</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/45">
          Envie a planilha exportada para atualizar o planejamento semanal.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-4">
        <label className="ba-label block">Arquivo da planilha</label>

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

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-sm text-white/55">
            {file ? file.name : "Nenhum arquivo escolhido"}
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.14em] text-orange-300 transition hover:border-orange-300/55 hover:bg-orange-400/15 hover:text-orange-200"
          >
            Escolher arquivo
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full border border-orange-400/35 bg-orange-400/90 px-5 py-2.5 text-[11px] font-black uppercase tracking-[.14em] text-black shadow-[0_0_30px_rgba(251,146,60,.13)] transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processando..." : "Enviar planilha"}
        </button>

        {status && <p className="text-sm text-white/45">{status}</p>}
      </div>
    </form>
  );
}

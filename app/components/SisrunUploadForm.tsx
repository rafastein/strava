"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SisrunUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
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
    <form onSubmit={handleSubmit} className="ba-card p-5 md:p-6">
      <div>
        <p className="ba-eyebrow">Upload</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Atualizar SisRUN</h2>
        <p className="mt-1 text-sm text-white/45">
          Envie a planilha exportada para atualizar o planejamento semanal.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-4">
        <label className="ba-label block">Arquivo da planilha</label>

        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            setStatus("");
          }}
          className="mt-3 block w-full cursor-pointer rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/65 file:mr-4 file:rounded-full file:border-0 file:bg-orange-400 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[.12em] file:text-black hover:border-orange-400/35 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
        />

        {file && (
          <p className="mt-3 text-xs text-white/40">
            Selecionado: <span className="text-white/65">{file.name}</span>
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-orange-400 px-5 py-3 text-xs font-black uppercase tracking-[.14em] text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processando..." : "Enviar planilha"}
        </button>

        {status && (
          <p className="text-sm text-white/45">
            {status}
          </p>
        )}
      </div>
    </form>
  );
}

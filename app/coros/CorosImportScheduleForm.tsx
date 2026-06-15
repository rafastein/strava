"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

const EXAMPLE_RAW = `Training Schedule
========================

2026-06-13
Longão 23k
Distance: 23.00 km
Estimated Time: 2:07:33
Load: 203 TL`;

type ImportResponse = {
  success?: boolean;
  importedCount?: number;
  dryRun?: boolean;
  workouts?: Array<{
    key: string;
    date: string;
    title: string;
    type: string;
    distanceKm: number | null;
    durationMin: number | null;
    source: string;
  }>;
  error?: string;
};

export default function CorosImportScheduleForm() {
  const [adminSecret, setAdminSecret] = useState("");
  const [rawText, setRawText] = useState("");
  const [preferredTitles, setPreferredTitles] = useState("2026-06-13=Longão 23k\n2026-06-20=20/06 Sab - Corrida Prova 10,0\n2026-06-21=21/06 Dom - Corrida Longo 25,0");
  const [dryRun, setDryRun] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const preferredTitlesByDate = useMemo(() => {
    return Object.fromEntries(
      preferredTitles
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [date, ...titleParts] = line.split("=");
          return [date?.trim(), titleParts.join("=").trim()];
        })
        .filter(([date, title]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Boolean(title)),
    );
  }, [preferredTitles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/coros/import-schedule", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          text: rawText,
          preferredTitlesByDate,
          dryRun,
        }),
      });

      const body = (await response.json()) as ImportResponse;
      setResult(response.ok ? body : { error: body.error ?? "Falha ao importar agenda." });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Falha ao importar agenda." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <label className="grid gap-2">
          <span className="ba-label">ADMIN_SECRET</span>
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            type="password"
            placeholder="Senha administrativa da Vercel"
            style={fieldStyle}
          />
        </label>
        <label className="grid gap-2">
          <span className="ba-label">Preferências de duplicidade</span>
          <textarea
            value={preferredTitles}
            onChange={(event) => setPreferredTitles(event.target.value)}
            rows={3}
            placeholder={"2026-06-13=Longão 23k\n2026-06-21=21/06 Dom - Corrida Longo 25,0"}
            style={fieldStyle}
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="ba-label">Agenda bruta do COROS MCP</span>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={12}
          placeholder={EXAMPLE_RAW}
          style={{ ...fieldStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 ba-muted" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Testar sem salvar
        </label>
        <button
          type="submit"
          disabled={isSubmitting || !adminSecret || !rawText.trim()}
          className="ba-back"
          style={{ cursor: isSubmitting ? "wait" : "pointer" }}
        >
          {isSubmitting ? "Importando..." : dryRun ? "Testar importação" : "Importar para Upstash"}
        </button>
      </div>

      {result && (
        <div className="ba-card-soft" style={{ padding: "1rem" }}>
          {result.error ? (
            <p style={{ color: "#fca5a5", fontWeight: 700 }}>{result.error}</p>
          ) : (
            <>
              <p style={{ color: "var(--text)", fontWeight: 800 }}>
                {result.dryRun ? "Dry-run concluído" : "Importação concluída"} · {result.importedCount ?? 0} treinos
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(result.workouts ?? []).map((workout) => (
                  <div key={`${workout.key}-${workout.title}`} className="ba-card-soft" style={{ padding: ".8rem" }}>
                    <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>{workout.date} · {workout.title}</p>
                    <p className="ba-muted" style={{ fontSize: 12 }}>{workout.source} · {workout.type}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </form>
  );
}

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".8rem 1rem",
  outline: "none",
  fontSize: 13,
};

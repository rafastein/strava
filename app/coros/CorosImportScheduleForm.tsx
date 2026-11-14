"use client";

import { useMemo, useState, type FormEvent } from "react";
import { fetchWithAdminRetry } from "../lib/admin-client";

const EXAMPLE_RAW = `Training Schedule
========================

2026-06-13
Longão 23k
Distance: 23.00 km
Estimated Time: 2:07:33
Load: 203 TL
Estrutura:
- 2 km Z1 aquecimento
- 7x 500m Z2 / 500m Z1
- 1 km Z1 desaquecimento`;

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
    estimatedTime?: string | null;
    loadTl?: number | null;
    steps?: Array<{ label: string }>;
    source: string;
  }>;
  error?: string;
};

export default function CorosImportScheduleForm() {
  const [rawText, setRawText] = useState("");
  const [preferredTitles, setPreferredTitles] = useState("");
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
      // Pede a senha administrativa só se o servidor recusar a primeira tentativa.
      const response = await fetchWithAdminRetry("/api/coros/import-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    <form onSubmit={handleSubmit} className="ui-stack">
      <label className="ui-label">
        Agenda bruta do COROS (texto do MCP)
        <textarea
          className="ui-field"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={10}
          placeholder={EXAMPLE_RAW}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}
        />
      </label>

      <label className="ui-label">
        Título preferido quando há dois treinos no mesmo dia (uma linha por data: AAAA-MM-DD=título)
        <textarea
          className="ui-field"
          value={preferredTitles}
          onChange={(event) => setPreferredTitles(event.target.value)}
          rows={3}
          placeholder={"2026-06-13=Longão 23k"}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
        <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} style={{ width: 20, height: 20 }} />
        Testar sem salvar
      </label>

      <button
        type="submit"
        disabled={isSubmitting || !rawText.trim()}
        className="ui-btn"
        style={{ border: 0, cursor: isSubmitting ? "wait" : "pointer", opacity: isSubmitting || !rawText.trim() ? 0.5 : 1 }}
      >
        {isSubmitting ? "Importando…" : dryRun ? "Testar importação" : "Importar e salvar"}
      </button>

      {result ? (
        <div role="status" className="ui-stack" style={{ gap: 8 }}>
          {result.error ? (
            <p style={{ color: "#ff8a7a", fontWeight: 600 }}>{result.error}</p>
          ) : (
            <>
              <p style={{ color: "var(--ui-text)", fontWeight: 600 }}>
                {result.dryRun ? "Teste concluído, nada foi salvo" : "Importação concluída"} · {result.importedCount ?? 0} treinos
              </p>
              <div className="ui-list" style={{ margin: "0 -20px" }}>
                {(result.workouts ?? []).map((workout) => (
                  <div key={`${workout.key}-${workout.title}`} className="ui-row" style={{ minHeight: 52 }}>
                    <span className="ui-row__main">
                      <span className="ui-row__title" style={{ whiteSpace: "normal" }}>{workout.title}</span>
                      <span className="ui-muted">
                        {[
                          workout.date,
                          workout.type,
                          workout.distanceKm ? `${workout.distanceKm.toFixed(1).replace(".", ",")} km` : null,
                          workout.loadTl ? `${Math.round(workout.loadTl)} TL` : null,
                          workout.estimatedTime ?? null,
                          workout.steps?.length ? `${workout.steps.length} ${workout.steps.length === 1 ? "bloco" : "blocos"}` : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

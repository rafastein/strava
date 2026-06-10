export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import SisrunUploadForm from "../components/SisrunUploadForm";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import {
  getSisrunData,
  getCurrentWeek,
  getTodaySisrunRow,
  getSisrunDataQualityWarnings,
} from "../lib/sisrun-utils";

type StravaActivity = {
  id: number;
  type: string;
  distance: number;
  start_date?: string;
  start_date_local?: string;
};

type WeekRow = NonNullable<Awaited<ReturnType<typeof getSisrunData>>>["rows"][number];

function parseBrDateLocal(date: string) {
  const [day, month, year] = date.split("/").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getWeekRows(
  sisrunData: Awaited<ReturnType<typeof getSisrunData>>,
  currentWeek: ReturnType<typeof getCurrentWeek>
) {
  if (!sisrunData?.rows?.length || !currentWeek) return [];
  const start = parseBrDateLocal(currentWeek.weekStart);
  const end   = parseBrDateLocal(currentWeek.weekEnd);
  return sisrunData.rows.filter((row) => {
    const rowDate = parseBrDateLocal(row.date);
    return rowDate >= start && rowDate <= end;
  });
}

function getDayLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(parseBrDateLocal(date))
    .replace(".", "")
    .toUpperCase();
}

function getActivityDateKey(activity: StravaActivity) {
  const raw = activity.start_date_local ?? activity.start_date;
  if (!raw) return null;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

async function getWeekStravaKmByDate(currentWeek: ReturnType<typeof getCurrentWeek>) {
  if (!currentWeek) return new Map<string, number>();
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return new Map<string, number>();
    const start = parseBrDateLocal(currentWeek.weekStart);
    const end   = parseBrDateLocal(currentWeek.weekEnd);
    end.setHours(23, 59, 59, 999);
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("after",  String(Math.floor(start.getTime() / 1000)));
    url.searchParams.set("before", String(Math.floor(end.getTime() / 1000)));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return new Map<string, number>();
    const activities = (await res.json()) as StravaActivity[];
    const map = new Map<string, number>();
    activities.filter((a) => a.type === "Run").forEach((a) => {
      const key = getActivityDateKey(a);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + a.distance / 1000);
    });
    return map;
  } catch { return new Map<string, number>(); }
}

function getCompletedKm(row: WeekRow, stravaKmByDate: Map<string, number>) {
  return Number(Math.max(row.completedDistanceKm ?? 0, stravaKmByDate.get(row.date) ?? 0).toFixed(1));
}

function formatKm(value: number) { return `${value.toFixed(1)} km`; }

export default async function SisrunPage() {
  const sisrunData      = await getSisrunData();
  const currentWeek     = getCurrentWeek(sisrunData);
  const todayRow        = getTodaySisrunRow(sisrunData);
  const dataWarnings    = getSisrunDataQualityWarnings(sisrunData);
  const weekRows        = getWeekRows(sisrunData, currentWeek);
  const stravaKmByDate  = await getWeekStravaKmByDate(currentWeek);
  const plannedDays     = weekRows.filter((r) => r.plannedDistanceKm > 0).length;
  const completedTodayKm = todayRow ? getCompletedKm(todayRow, stravaKmByDate) : 0;

  return (
    <div className="page">
      <Navbar />
      <main className="ba-page">

        {/* ── HEADER ── */}
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">SisRUN</p>
            <h1 className="ba-title">Planejamento semanal</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Planejamento extraído da planilha atual, com resumo da semana,
              volume previsto e distribuição dos treinos dia a dia.
            </p>
          </div>
          <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
        </div>

        {/* ── UPLOAD + RESUMO ── */}
        <section className="ba-section ba-grid-2" style={{ marginBottom: "1rem" }}>
          <SisrunUploadForm />

          <div className="ba-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "1.25rem" }}>
              <div>
                <p className="ba-eyebrow">Semana atual</p>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#fff", marginTop: 4 }}>
                  Resumo da semana
                </h2>
              </div>
              {currentWeek && (
                <span className="badge badge--muted">{plannedDays} dias com treino</span>
              )}
            </div>

            {currentWeek ? (
              <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                {/* Período */}
                <div className="ba-card-soft" style={{ padding: "1rem" }}>
                  <p className="ba-label">Período</p>
                  <p style={{ marginTop: ".4rem", fontSize: 15, fontWeight: 600, color: "#f5a623" }}>
                    {currentWeek.weekStart} até {currentWeek.weekEnd}
                  </p>
                </div>

                {/* Métricas */}
                <div className="ba-grid-2">
                  <div className="ba-card-soft" style={{ padding: "1rem", textAlign: "center" }}>
                    <p className="ba-label">Km planejados</p>
                    <p className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem" }}>
                      {formatKm(currentWeek.totalPlannedKm)}
                    </p>
                  </div>
                  <div className="ba-card-soft" style={{ padding: "1rem", textAlign: "center" }}>
                    <p className="ba-label">Longão planejado</p>
                    <p className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem" }}>
                      {formatKm(currentWeek.longRunPlannedKm)}
                    </p>
                  </div>
                </div>

                {/* Treino de hoje */}
                <div className="ba-card-soft" style={{ padding: "1rem" }}>
                  <p className="ba-label" style={{ marginBottom: ".75rem" }}>Treino de hoje</p>
                  {todayRow ? (
                    <div className="ba-grid-3">
                      {[
                        { label: "Planejado", value: formatKm(todayRow.plannedDistanceKm) },
                        { label: "Feito",     value: formatKm(completedTodayKm) },
                        { label: "Janela",    value: `${todayRow.minPlannedTime ?? "-"} / ${todayRow.maxPlannedTime ?? "-"}` },
                      ].map((m) => (
                        <div key={m.label} style={{ textAlign: "center" }}>
                          <p className="ba-label">{m.label}</p>
                          <p style={{ marginTop: ".35rem", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ba-muted">Nenhum treino previsto para hoje.</p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ border: "1px dashed rgba(255,255,255,.1)", borderRadius: 16, padding: "1.5rem", textAlign: "center" }}>
                <p className="ba-muted">Nenhuma planilha carregada ainda.</p>
              </div>
            )}
          </div>
        </section>

        {dataWarnings.length > 0 && (
          <section className="ba-card" style={{ padding: "1.25rem", marginBottom: "1rem", borderColor: "rgba(245,166,35,.28)" }}>
            <p className="ba-eyebrow">Qualidade dos dados</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", color: "#fff", marginTop: 4 }}>
              Atenção ao SisRUN carregado
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", marginTop: "1rem" }}>
              {dataWarnings.map((warning, index) => (
                <div key={`${warning.title}-${index}`} className="ba-card-soft" style={{ padding: "1rem" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warning.level === "error" ? "#ff8a8a" : "#f5a623" }}>
                    {warning.title}
                  </p>
                  <p className="ba-muted" style={{ marginTop: ".35rem" }}>{warning.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── AGENDA ── */}
        <section className="ba-card sisrun-agenda-card">
          <div className="sisrun-agenda-head">
            <div>
              <p className="ba-eyebrow">Agenda</p>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#fff", marginTop: 4 }}>
                Dias da semana atual
              </h2>
              <p className="ba-muted" style={{ marginTop: ".4rem" }}>
                Planejamento diário extraído da planilha do SisRUN, com execução preenchida pelo maior valor entre planilha e Strava.
              </p>
            </div>
            {currentWeek && (
              <span className="badge badge--muted">{currentWeek.weekStart} — {currentWeek.weekEnd}</span>
            )}
          </div>

          {!sisrunData?.rows?.length || !currentWeek ? (
            <div style={{ border: "1px dashed rgba(255,255,255,.1)", borderRadius: 16, padding: "1.5rem", textAlign: "center" }}>
              <p className="ba-muted">Sem dados para exibir.</p>
            </div>
          ) : (
            <div className="sisrun-week-list">
              {weekRows.map((row, index) => {
                const hasWorkout  = row.plannedDistanceKm > 0;
                const completedKm = getCompletedKm(row, stravaKmByDate);
                const done        = completedKm >= row.plannedDistanceKm && hasWorkout;

                return (
                  <div key={`${row.date}-${index}`} className="ba-card-soft sisrun-day-card">
                    <div className="sisrun-day-card__inner">
                      {/* Day badge */}
                      <div
                        className="sisrun-day-badge"
                        style={{
                          background: hasWorkout ? "rgba(245,166,35,.1)" : "rgba(255,255,255,.04)",
                          border: `1px solid ${hasWorkout ? "rgba(245,166,35,.25)" : "rgba(255,255,255,.07)"}`,
                          color: hasWorkout ? "#f5a623" : "rgba(255,255,255,.3)",
                        }}
                      >
                        {getDayLabel(row.date)}
                      </div>

                      {/* Content */}
                      <div className="sisrun-day-content">
                        <div className="sisrun-day-summary">
                          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.3)", marginBottom: 4 }}>{row.date}</p>
                          <p style={{ fontSize: 14, fontWeight: 600, color: hasWorkout ? "var(--text)" : "rgba(255,255,255,.4)" }}>
                            {hasWorkout ? `${formatKm(row.plannedDistanceKm)} planejados` : "Descanso / sem volume planejado"}
                          </p>
                        </div>

                        <div className="sisrun-day-metrics">
                          {[
                            { label: "Planejado", value: formatKm(row.plannedDistanceKm) },
                            { label: "Feito",     value: formatKm(completedKm),           accent: done },
                            { label: "Tempo mín.", value: row.minPlannedTime ?? "-" },
                            { label: "Tempo máx.", value: row.maxPlannedTime ?? "-" },
                          ].map((m) => (
                            <div key={m.label} className="sisrun-day-metric">
                              <p className="ba-label">{m.label}</p>
                              <p style={{ marginTop: ".3rem", fontSize: 12, fontWeight: 600, color: m.accent ? "var(--success)" : "var(--text)" }}>{m.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

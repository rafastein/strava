export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { formatBRDate } from "../lib/date-utils";
import {
  formatEfficiency,
  formatLongRunDuration,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
} from "../lib/strava-long-runs";
import LongRunCharts from "../components/LongRunCharts";
import ActivitySplitsChart from "../components/ActivitySplitsChart";

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  type: string;
  start_date: string;
  start_date_local: string;
  start_latlng?: [number, number] | [] | null;
  location_city?: string | null;
  location_state?: string | null;
};

const STRAVA_AFTER_EPOCH = Math.floor(
  new Date("2024-01-01T00:00:00Z").getTime() / 1000,
);
const BUENOS_AIRES_GOAL_PACE_SEC_PER_KM = 320;

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];

    const allActivities: StravaActivity[] = [];
    const perPage = 200;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      url.searchParams.set("after", String(STRAVA_AFTER_EPOCH));

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (!res.ok) break;

      const pageActivities = (await res.json()) as StravaActivity[];
      if (!Array.isArray(pageActivities) || pageActivities.length === 0) break;

      allActivities.push(...pageActivities);
      if (pageActivities.length < perPage) break;
    }

    return allActivities;
  } catch {
    return [];
  }
}

function getEfficiencyBadge(efficiency: number | null): {
  label: string;
  badge: string;
} {
  if (!efficiency) return { label: "Sem dados", badge: "badge badge--muted" };
  if (efficiency >= 16) return { label: "Alta eficiência", badge: "badge badge--success" };
  if (efficiency >= 14) return { label: "Boa eficiência", badge: "badge badge--blue" };
  return { label: "Eficiência moderada", badge: "badge badge--orange" };
}

function getEfficiencyTrend(
  current?: number | null,
  previous?: number | null,
): { emoji: string; label: string; detail: string; tone: string } {
  if (!current || !previous)
    return {
      emoji: "➖",
      label: "Sem base anterior",
      detail: "Ainda não há longão anterior com eficiência para comparar.",
      tone: "text-white/45",
    };

  const diff = current - previous;
  if (Math.abs(diff) < 1)
    return {
      emoji: "➖",
      label: "Estável",
      detail: `Variação de ${diff >= 0 ? "+" : ""}${diff.toFixed(0)} ponto.`,
      tone: "text-white/55",
    };

  if (diff > 0)
    return {
      emoji: "📈",
      label: "Melhorou",
      detail: `+${diff.toFixed(0)} pontos em relação ao longão anterior.`,
      tone: "text-emerald-400",
    };

  return {
    emoji: "📉",
    label: "Piorou",
    detail: `${diff.toFixed(0)} pontos em relação ao longão anterior.`,
    tone: "text-red-400",
  };
}

function InfoCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "accent" | "blue" | "success" | "danger";
}) {
  const valueClass = {
    accent: "ba-value--accent",
    blue: "ba-value--blue",
    success: "ba-value--success",
    danger: "ba-value--danger",
  }[accent ?? "accent"];

  return (
    <div className="ba-card longoes-info-card" style={{ padding: "1.2rem 1.4rem", textAlign: "center" }}>
      <p className="ba-label">{title}</p>
      <h2 className={`ba-value ${accent ? valueClass : ""}`} style={{ marginTop: ".4rem", fontSize: "clamp(1.4rem, 2.5vw, 2rem)" }}>{value}</h2>
      {sub && <p className="ba-muted" style={{ marginTop: ".3rem" }}>{sub}</p>}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ba-card-soft longoes-metric-pill" style={{ padding: ".65rem 1rem" }}>
      <p className="ba-label">{label}</p>
      <p style={{ marginTop: ".25rem", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function PaceBar({
  paceSecPerKm,
  best,
  worst,
}: {
  paceSecPerKm: number | null;
  best: number;
  worst: number;
}) {
  if (!paceSecPerKm || worst === best) return null;
  const pct = Math.min(
    100,
    Math.max(0, ((worst - paceSecPerKm) / (worst - best)) * 100),
  );

  return (
    <div className="ba-progress mt-3">
      <div className="ba-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function LongoesPage() {
  const activities = await getActivities();
  const longRuns = await getLongRunsFromActivities(activities);
  const summary = getLongRunSummary(longRuns);

  const lastLongRun = longRuns[0] ?? null;
  const previousLongRun = longRuns[1] ?? null;
  const efficiencyTrend = getEfficiencyTrend(
    lastLongRun?.efficiency,
    previousLongRun?.efficiency,
  );

  const validPaces = longRuns
    .map((r) => r.paceSecPerKm)
    .filter((p): p is number => p !== null && Number.isFinite(p));
  const bestPace = validPaces.length ? Math.min(...validPaces) : 0;
  const worstPace = validPaces.length ? Math.max(...validPaces) : 0;
  const bestPaceRun = bestPace
    ? longRuns.find((r) => r.paceSecPerKm === bestPace)
    : null;
  const longestDistanceRun = longRuns.length
    ? longRuns.reduce((best, run) =>
        run.distanceKm > best.distanceKm ? run : best,
      )
    : null;

  const validEff = longRuns
    .map((r) => r.efficiency)
    .filter((e): e is number => e !== null && Number.isFinite(e));
  const bestEffValue = validEff.length ? Math.max(...validEff) : null;
  const bestEffRun = bestEffValue !== null
    ? longRuns.find((r) => r.efficiency === bestEffValue)
    : null;

  const progressiveRuns = longRuns.filter((r, i) => {
    if (i >= longRuns.length - 1) return false;
    const prev = longRuns[i + 1];
    return (r.efficiency ?? 0) > (prev.efficiency ?? 0);
  }).length;

  const longRuns25Plus = longRuns.filter((r) => r.distanceKm >= 25).length;
  const avgDistance = summary.totalLongRuns
    ? longRuns.reduce((acc, run) => acc + run.distanceKm, 0) / summary.totalLongRuns
    : 0;

  const chartData = longRuns.map((r) => ({
    id: r.id,
    date: r.date,
    distanceKm: r.distanceKm,
    paceSecPerKm: r.paceSecPerKm,
    averageHeartrate: r.averageHeartrate,
    maxHeartrate: r.maxHeartrate,
    efficiency: r.efficiency,
  }));

  return (
    <main className="page longoes-page">
      <Navbar />
      <div className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Treinos</p>
            <h1 className="ba-title">Análise de longões</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Histórico completo com evolução de distância, ritmo, frequência cardíaca,
              elevação, eficiência e splits km a km.
            </p>
          </div>

          <Link href="/" className="ba-back">
            ← Voltar ao dashboard
          </Link>
        </div>

        <section className="longoes-section longoes-summary-section" style={{ marginBottom: "4rem" }}>
          <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Resumo geral</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 longoes-summary-grid">
            <InfoCard title="Total de longões" value={String(summary.totalLongRuns)} sub="desde jan/2024" />
            <InfoCard
              title="Maior distância"
              value={`${summary.longestRunKm.toFixed(1)} km`}
              sub={longestDistanceRun ? formatBRDate(longestDistanceRun.date) : undefined}
              accent="accent"
            />
            <InfoCard
              title="Melhor ritmo"
              value={formatLongRunPace(bestPace)}
              sub={bestPaceRun ? formatBRDate(bestPaceRun.date) : undefined}
              accent="blue"
            />
            <InfoCard
              title="Melhor eficiência"
              value={formatEfficiency(summary.bestEfficiency)}
              sub={bestEffRun ? formatBRDate(bestEffRun.date) : undefined}
              accent="success"
            />
            <InfoCard title="FC média geral" value={summary.averageHeartrate ? `${summary.averageHeartrate.toFixed(0)} bpm` : "—"} />
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3 longoes-section longoes-insights-grid" style={{ marginBottom: "3.5rem" }}>
          <div className="ba-card ba-card--accent min-h-[340px] longoes-insight-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow ba-section">Último longão</p>
            {lastLongRun ? (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "calc(100% - 2rem)" }}>
                <div>
                  <h2 className="max-w-[92%] text-xl font-semibold leading-snug text-white/90">
                    {lastLongRun.name}
                  </h2>
                  <p className="mt-3 text-sm text-white/45">{formatBRDate(lastLongRun.date)}</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="badge badge--accent">{lastLongRun.distanceKm.toFixed(2)} km</span>
                  <span className="badge badge--blue">{formatLongRunPace(lastLongRun.paceSecPerKm)}</span>
                  {lastLongRun.averageHeartrate && (
                    <span className="badge badge--danger">{lastLongRun.averageHeartrate.toFixed(0)} bpm</span>
                  )}
                </div>

                <div className="pt-4">
                  <PaceBar paceSecPerKm={lastLongRun.paceSecPerKm} best={bestPace} worst={worstPace} />
                  <p className="mt-3 text-xs text-white/35">Posição relativa de ritmo no histórico.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">Nenhum longão encontrado.</p>
            )}
          </div>

          <div className="ba-card min-h-[340px] longoes-insight-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Tendência de eficiência</p>
            <div className="flex items-center gap-4">
              <span className="text-3xl">{efficiencyTrend.emoji}</span>
              <div>
                <p className={`text-xl font-bold ${efficiencyTrend.tone}`}>{efficiencyTrend.label}</p>
                <p className="mt-1 text-sm text-white/45">{efficiencyTrend.detail}</p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex justify-between text-sm"><span className="text-white/45">Último</span><span className="font-semibold text-white/85">{formatEfficiency(lastLongRun?.efficiency ?? null)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/45">Anterior</span><span className="font-semibold text-white/85">{formatEfficiency(previousLongRun?.efficiency ?? null)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/45">Melhor</span><span className="font-semibold text-emerald-400">{formatEfficiency(summary.bestEfficiency)}</span></div>
            </div>
          </div>

          <div className="ba-card min-h-[340px] longoes-insight-card longoes-pattern-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Padrões identificados</p>
            <div className="space-y-5">
              <MetricPill label="Longões com melhora" value={`${progressiveRuns} em relação ao anterior`} />
              <MetricPill label="Longões 25 km+" value={`${longRuns25Plus} treinos`} />
              <MetricPill label="Distância média" value={`${avgDistance.toFixed(1)} km por longão`} />
              <MetricPill label="Elevação média" value={`${summary.averageElevationGain.toFixed(0)} m por longão`} />
            </div>
          </div>
        </section>

        <section className="longoes-section longoes-evolution-section" style={{ marginBottom: "3.5rem" }}>
          <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Evolução</p>
          <LongRunCharts longRuns={chartData} />
        </section>

        <section className="ba-card longoes-history-card" style={{ padding: "2rem", marginTop: "0" }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Histórico completo</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white/90">
                Longões registrados
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Do mais recente ao mais antigo — distância, ritmo, FC, elevação, eficiência e splits.
              </p>
            </div>
            <span className="badge badge--accent">{summary.totalLongRuns} longões</span>
          </div>

          {longRuns.length === 0 ? (
            <p className="text-sm text-white/50">Nenhuma atividade com nome “Longão” foi encontrada.</p>
          ) : (
            <div className="space-y-12 longoes-history-list">
              {longRuns.map((run, index) => {
                const previous = longRuns[index + 1];
                const trend = getEfficiencyTrend(run.efficiency, previous?.efficiency);
                const effBadge = getEfficiencyBadge(run.efficiency);
                const isBest = run.efficiency === bestEffValue;

                return (
                  <div key={run.id} className={`ba-card longoes-run-card ${isBest ? "ba-card--accent" : ""}`} style={{ padding: "2rem 2rem 3rem" }}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-white/35">
                          {longRuns.length - index}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white/90">{run.name}</p>
                            {isBest && <span className="badge badge--accent">Melhor eficiência</span>}
                          </div>
                          <p className="mt-1 text-sm text-white/45">
                            {formatBRDate(run.date)}
                            {run.city && run.city !== "Não identificado"
                              ? ` · ${run.city}${run.state ? `, ${run.state}` : ""}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge--accent">{run.distanceKm.toFixed(2)} km</span>
                        <span className={effBadge.badge}>{effBadge.label}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 longoes-run-metrics" style={{ marginTop: "1.75rem" }}>
                      <MetricPill label="Tempo" value={formatLongRunDuration(run.movingTimeSec)} />
                      <MetricPill label="Ritmo" value={formatLongRunPace(run.paceSecPerKm)} />
                      <MetricPill label="Ritmo ajustado" value={formatLongRunPace(run.adjustedPaceSecPerKm)} />
                      <MetricPill label="FC média" value={run.averageHeartrate ? `${run.averageHeartrate.toFixed(0)} bpm` : "—"} />
                      <MetricPill label="FC máxima" value={run.maxHeartrate ? `${run.maxHeartrate} bpm` : "—"} />
                      <MetricPill label="Elevação" value={`${run.elevationGain.toFixed(0)} m`} />
                    </div>

                    <div
                      className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 longoes-efficiency-row"
                      style={{ marginTop: "1.75rem", paddingTop: "1.5rem" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/35">Eficiência:</span>
                        <span className="text-sm font-bold text-white/90">{formatEfficiency(run.efficiency)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-sm">{trend.emoji}</span>
                        <span className={`text-xs font-medium ${trend.tone}`}>{trend.label}</span>
                        <span className="hidden text-xs text-white/35 sm:inline">{trend.detail}</span>
                      </div>
                    </div>

                    <div className="longoes-pace-block" style={{ marginTop: "1rem", marginBottom: "1.75rem" }}>
                      <PaceBar paceSecPerKm={run.paceSecPerKm} best={bestPace} worst={worstPace} />
                      <p className="mt-2 text-right text-xs text-white/20">posição de ritmo no histórico</p>
                    </div>

                    <div className="border-t border-white/10 longoes-splits-block" style={{ paddingTop: "1.5rem" }}>
                      <ActivitySplitsChart
                        activityId={Number(run.id)}
                        activityName={run.name}
                        targetPaceSecPerKm={run.paceSecPerKm ?? undefined}
                        goalPaceSecPerKm={BUENOS_AIRES_GOAL_PACE_SEC_PER_KM}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </main>
  );
}
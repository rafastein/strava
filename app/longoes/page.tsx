export const dynamic = "force-dynamic";

import Link from "next/link";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { formatBRDate } from "../lib/date-utils";
import {
  formatEfficiency,
  formatLongRunDuration,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
  type LongRunEntry,
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
  new Date("2024-01-01T00:00:00Z").getTime() / 1000
);

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
  if (!efficiency)
    return { label: "Sem dados", badge: "bg-white/5 text-zinc-400" };
  if (efficiency >= 16)
    return { label: "Alta eficiência", badge: "bg-emerald-500/10 border border-emerald-400/20 text-emerald-300" };
  if (efficiency >= 14)
    return { label: "Boa eficiência", badge: "bg-blue-500/10 border border-blue-400/20 text-blue-300" };
  return { label: "Eficiência moderada", badge: "bg-orange-500/10 border border-orange-400/20 text-orange-300" };
}

function getEfficiencyTrend(
  current?: number | null,
  previous?: number | null
): { emoji: string; label: string; detail: string; tone: string } {
  if (!current || !previous)
    return {
      emoji: "➖",
      label: "Sem base anterior",
      detail: "Ainda não há longão anterior com eficiência para comparar.",
      tone: "text-zinc-400",
    };
  const diff = current - previous;
  if (Math.abs(diff) < 1)
    return {
      emoji: "➖",
      label: "Estável",
      detail: `Variação de ${diff >= 0 ? "+" : ""}${diff.toFixed(0)} ponto.`,
      tone: "text-zinc-300",
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
    tone: "text-red-300",
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
  accent?: "orange" | "blue" | "green" | "red";
}) {
  const colors = {
    orange: "text-orange-400",
    blue: "text-blue-400",
    green: "text-emerald-400",
    red: "text-red-300",
  };
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{title}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight ${accent ? colors[accent] : "text-zinc-100"}`}>
        {value}
      </h2>
      {sub && <p className="mt-2 truncate text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
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
  const pct = Math.min(100, Math.max(0, ((worst - paceSecPerKm) / (worst - best)) * 100));
  return (
    <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
      <div
        className="h-1.5 rounded-full bg-orange-400 transition-all"
        style={{ width: `${pct}%` }}
      />
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
    previousLongRun?.efficiency
  );

  const validPaces = longRuns
    .map((r) => r.paceSecPerKm)
    .filter((p): p is number => p !== null && Number.isFinite(p));
  const bestPace = validPaces.length ? Math.min(...validPaces) : 0;
  const worstPace = validPaces.length ? Math.max(...validPaces) : 0;

  const validEff = longRuns
    .map((r) => r.efficiency)
    .filter((e): e is number => e !== null && Number.isFinite(e));
  const bestEffValue = validEff.length ? Math.max(...validEff) : null;
  const bestEffRun = bestEffValue
    ? longRuns.find((r) => r.efficiency === bestEffValue)
    : null;

  const progressiveRuns = longRuns.filter((r, i) => {
    if (i >= longRuns.length - 1) return false;
    const prev = longRuns[i + 1];
    return (r.efficiency ?? 0) > (prev.efficiency ?? 0);
  }).length;

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
    <main className="min-h-screen page-shell">
      <div>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-400">Treinos</p>
            <h1 className="text-4xl font-black tracking-tight text-zinc-100 md:text-6xl">
              Análise de longões
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Histórico completo com evolução de ritmo, FC e eficiência.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full btn-back"
          >
            ← Voltar ao dashboard
          </Link>
        </div>

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <InfoCard
            title="Total de longões"
            value={String(summary.totalLongRuns)}
            sub="desde jan/2024"
          />
          <InfoCard
            title="Maior distância"
            value={`${summary.longestRunKm.toFixed(1)} km`}
            accent="orange"
          />
          <InfoCard
            title="Melhor ritmo"
            value={formatLongRunPace(bestPace)}
            sub={bestEffRun ? formatBRDate(bestEffRun.date) : undefined}
            accent="blue"
          />
          <InfoCard
            title="Melhor eficiência"
            value={formatEfficiency(summary.bestEfficiency)}
            sub={bestEffRun?.name}
            accent="green"
          />
          <InfoCard
            title="FC média geral"
            value={
              summary.averageHeartrate
                ? `${summary.averageHeartrate.toFixed(0)} bpm`
                : "-"
            }
          />
        </section>

        {/* Trend + last run + patterns */}
        <section className="mb-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl premium-panel p-5">
            <h3 className="text-base font-semibold text-zinc-100">Último longão</h3>
            {lastLongRun ? (
              <>
                <p className="mt-3 font-medium text-zinc-200">{lastLongRun.name}</p>
                <p className="mt-1 text-sm text-zinc-400">{formatBRDate(lastLongRun.date)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-orange-500/10 border border-orange-400/20 px-3 py-1 text-sm font-semibold text-orange-300">
                    {lastLongRun.distanceKm.toFixed(2)} km
                  </span>
                  <span className="rounded-full bg-blue-500/10 border border-blue-400/20 px-3 py-1 text-sm font-medium text-blue-300">
                    {formatLongRunPace(lastLongRun.paceSecPerKm)}
                  </span>
                  {lastLongRun.averageHeartrate && (
                    <span className="rounded-full bg-red-500/10 border border-red-400/20 px-3 py-1 text-sm font-medium text-red-300">
                      {lastLongRun.averageHeartrate.toFixed(0)} bpm
                    </span>
                  )}
                </div>
                <PaceBar
                  paceSecPerKm={lastLongRun.paceSecPerKm}
                  best={bestPace}
                  worst={worstPace}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Posição relativa de ritmo no histórico
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Nenhum longão encontrado.</p>
            )}
          </div>

          <div className="rounded-3xl premium-panel p-5">
            <h3 className="text-base font-semibold text-zinc-100">Tendência de eficiência</h3>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-3xl">{efficiencyTrend.emoji}</span>
              <div>
                <p className={`text-xl font-bold ${efficiencyTrend.tone}`}>
                  {efficiencyTrend.label}
                </p>
                <p className="mt-0.5 text-sm text-zinc-400">{efficiencyTrend.detail}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Último longão</span>
                <span className="font-semibold text-zinc-100">
                  {formatEfficiency(lastLongRun?.efficiency ?? null)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Longão anterior</span>
                <span className="font-semibold text-zinc-100">
                  {formatEfficiency(previousLongRun?.efficiency ?? null)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Melhor histórico</span>
                <span className="font-semibold text-emerald-400">
                  {formatEfficiency(summary.bestEfficiency)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl premium-panel p-5">
            <h3 className="text-base font-semibold text-zinc-100">Padrões identificados</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/20 text-sm font-bold text-emerald-300">
                  {progressiveRuns}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Longões com melhora de eficiência
                  </p>
                  <p className="text-xs text-zinc-500">em relação ao anterior</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 border border-blue-400/20 text-sm font-bold text-blue-300">
                  {summary.totalLongRuns}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Longões registrados
                  </p>
                  <p className="text-xs text-zinc-500">
                    ritmo médio {formatLongRunPace(summary.averagePaceSecPerKm)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/20 text-sm font-bold text-orange-400">
                  ↑
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Elevação média
                  </p>
                  <p className="text-xs text-zinc-500">
                    {summary.averageElevationGain.toFixed(0)} m por longão
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Charts */}
        <section className="mb-6">
          <LongRunCharts longRuns={chartData} />
        </section>

        {/* Full history */}
        <section className="rounded-3xl premium-panel p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Histórico completo</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Do mais recente ao mais antigo — distância, ritmo, FC, elevação e eficiência.
              </p>
            </div>
            <span className="rounded-full bg-orange-500/10 border border-orange-400/20 px-3 py-1 text-sm font-semibold text-orange-300">
              {summary.totalLongRuns} longões
            </span>
          </div>

          {longRuns.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Nenhuma atividade com nome "Longão" foi encontrada.
            </p>
          ) : (
            <div className="space-y-3">
              {longRuns.map((run, index) => {
                const previous = longRuns[index + 1];
                const trend = getEfficiencyTrend(run.efficiency, previous?.efficiency);
                const effBadge = getEfficiencyBadge(run.efficiency);
                const isBest = run.efficiency === bestEffValue;

                return (
                  <div
                    key={run.id}
                    className={`rounded-2xl border p-4 transition-colors hover:bg-white/[0.035] ${
                      isBest
                        ? "border-orange-400/30 bg-orange-500/10"
                        : "border-white/10 bg-white/[0.035]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-zinc-500 border border-white/10">
                          {longRuns.length - index}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-zinc-100">{run.name}</p>
                            {isBest && (
                              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                                Melhor eficiência
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-zinc-400">
                            {formatBRDate(run.date)}
                            {run.city && run.city !== "Não identificado"
                              ? ` · ${run.city}${run.state ? `, ${run.state}` : ""}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-orange-500/10 border border-orange-400/20 px-3 py-1 text-sm font-semibold text-orange-300">
                          {run.distanceKm.toFixed(2)} km
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${effBadge.badge}`}>
                          {effBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                      <MetricPill
                        label="Tempo"
                        value={formatLongRunDuration(run.movingTimeSec)}
                      />
                      <MetricPill
                        label="Ritmo"
                        value={formatLongRunPace(run.paceSecPerKm)}
                      />
                      <MetricPill
                        label="Ritmo ajustado"
                        value={formatLongRunPace(run.adjustedPaceSecPerKm)}
                      />
                      <MetricPill
                        label="FC média"
                        value={
                          run.averageHeartrate
                            ? `${run.averageHeartrate.toFixed(0)} bpm`
                            : "-"
                        }
                      />
                      <MetricPill
                        label="FC máxima"
                        value={run.maxHeartrate ? `${run.maxHeartrate} bpm` : "-"}
                      />
                      <MetricPill
                        label="Elevação"
                        value={`${run.elevationGain.toFixed(0)} m`}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Eficiência:</span>
                        <span className="text-sm font-bold text-zinc-100">
                          {formatEfficiency(run.efficiency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{trend.emoji}</span>
                        <span className={`text-xs font-medium ${trend.tone}`}>
                          {trend.label}
                        </span>
                        <span className="hidden text-xs text-zinc-500 sm:inline">
                          {trend.detail}
                        </span>
                      </div>
                    </div>

                    <PaceBar
                      paceSecPerKm={run.paceSecPerKm}
                      best={bestPace}
                      worst={worstPace}
                    />
                    <p className="mt-0.5 text-right text-xs text-zinc-500">
                      posição de ritmo no histórico
                    </p>

                    <div className="mt-3">
                      <ActivitySplitsChart
                        activityId={Number(run.id)}
                        activityName={run.name}
                        targetPaceSecPerKm={run.paceSecPerKm ?? undefined}
                        goalPaceSecPerKm={320}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

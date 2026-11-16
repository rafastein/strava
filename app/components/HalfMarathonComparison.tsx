"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataset } from "chart.js";
import { formatDuration } from "../lib/format";
import { getBestHalfIndex, getHalfRacePace } from "../lib/half-marathon";
import { applyChartTheme } from "../lib/chart-theme";

export type HalfMarathonEntry = {
  id: number;
  name: string;
  date: string;
  distanceKm: number;
  gearName?: string | null;
  /** Tempo da prova em segundos (decorrido no Strava). */
  timeSec?: number | null;
  splitSource?: "splits_metric" | "laps" | "estimated";
  splits: { km: number; paceSecPerKm: number; heartrate: number | null; distanceM?: number }[];
};

type Props = {
  races: HalfMarathonEntry[];
};

const COLORS = [
  "#3b82f6", // blue
  "#f97316", // orange
  "#10b981", // green
  "#8b5cf6", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
];

function formatPace(secPerKm: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "-";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}


function formatDistanceKm(distanceKm: number): string {
  if (!distanceKm || !Number.isFinite(distanceKm)) return "-";

  return `${distanceKm.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return iso.slice(0, 10); }
}

function cleanRaceName(name: string): string {
  return name
    .replace(/^\s*prova:\s*/i, "")
    .replace(/\s*\*{2,}\s*$/g, "")
    .trim();
}

const CLOSED_KM_MIN_DISTANCE_M = 990;

function getInitialVisible(races: HalfMarathonEntry[]) {
  const visible = new Set(races.slice(0, 3).map((_, index) => index));
  const best = getBestHalfIndex(races);
  if (best >= 0) visible.add(best);
  return visible;
}

function isClosedKmSplit(split: HalfMarathonEntry["splits"][number]): boolean {
  // O último split do Strava pode ter poucos metros, mas o pace vem normalizado para 1 km.
  // Para "Melhor km", consideramos apenas quilômetros realmente fechados.
  return (split.distanceM ?? 1000) >= CLOSED_KM_MIN_DISTANCE_M;
}

export default function HalfMarathonComparison({ races }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);
  // Todas sobrepostas viram um emaranhado no celular: começa com as 3 mais recentes e a mais rápida.
  const [visible, setVisible] = useState<Set<number>>(() => getInitialVisible(races));

  const toggleRace = (idx: number) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { if (next.size > 1) next.delete(idx); }
      else next.add(idx);
      return next;
    });
  };

  const render = useCallback(async () => {
    if (!chartRef.current || races.length === 0) return;

    const { Chart, registerables } = await import("chart.js");
    Chart.register(...registerables);
      applyChartTheme(Chart);

    if (chartInstance.current) {
      (chartInstance.current as { destroy: () => void }).destroy();
      chartInstance.current = null;
    }

    const gridColor = "#262a2f";
    const tickColor = "#9ba1a9";

    const maxKm = Math.max(...races.map((r) => r.splits.length));
    const labels = Array.from({ length: maxKm }, (_, i) => `${i + 1}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: ChartDataset<any, any>[] = races
      .filter((_, i) => visible.has(i))
      .map((race, visIdx) => {
        const origIdx = races.indexOf(race);
        const color = COLORS[origIdx % COLORS.length];
        return {
          type: "line" as const,
          label: `${formatShortDate(race.date)} ${cleanRaceName(race.name)}${race.splitSource === "estimated" ? " (média)" : ""}`,
          data: race.splits.map((s) =>
            s.paceSecPerKm > 0 && s.paceSecPerKm < 900
              ? s.paceSecPerKm / 60
              : null
          ),
          borderColor: color,
          backgroundColor: "transparent",
          pointRadius: visIdx === 0 ? 3 : 2,
          pointBackgroundColor: color,
          tension: 0.35,
          spanGaps: true,
          borderWidth: origIdx === 0 ? 2.5 : 1.5,
        };
      });

    const allPaces = races
      .filter((_, i) => visible.has(i))
      .flatMap((r) => r.splits.map((s) => s.paceSecPerKm))
      .filter((p) => p > 0 && p < 900)
      .map((p) => p / 60);

    // Limites em múltiplos de 15 s para o eixo mostrar paces redondos (4:30, 4:45…).
    const paceMin = allPaces.length ? Math.floor(Math.min(...allPaces) * 4) / 4 : 4;
    const paceMax = allPaces.length ? Math.ceil(Math.max(...allPaces) * 4) / 4 : 6.5;

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index" as const,
            intersect: false,
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number | null;
                if (!val) return `${ctx.dataset.label}: -`;
                return `${ctx.dataset.label}: ${formatPace(val * 60)}/km`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { size: 12 }, maxTicksLimit: 8, maxRotation: 0 },
            grid: { color: gridColor },
          },
          y: {
            reverse: true,
            min: paceMin,
            max: paceMax,
            ticks: {
              color: tickColor,
              font: { size: 12 },
              callback: (v: unknown) => {
                const val = typeof v === "number" ? v * 60 : 0;
                return formatPace(val);
              },
            },
            grid: { color: gridColor },
            title: { display: false },
          },
        },
      },
    });
  }, [races, visible]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  if (races.length === 0) {
    return <p className="ui-card ui-card--pad ui-muted">Nenhuma meia maratona com splits disponíveis.</p>;
  }

  const bestIndex = getBestHalfIndex(races);

  return (
    <div className="hoje-col">
      <section className="ui-card ui-card--pad ui-stack" aria-label="Splits km a km">
        <div>
          <h2 className="ui-h2">Km a km</h2>
          <p className="ui-muted">Pace de cada quilômetro, mais rápido no alto. Escolha as provas na lista abaixo.</p>
        </div>
        <div style={{ position: "relative", height: 260 }}>
          <canvas ref={chartRef} role="img" aria-label="Pace km a km das meias maratonas selecionadas" />
        </div>
      </section>

      <section className="ui-section" aria-label="Provas">
        <div className="ui-section__head">
          <h2 className="ui-h2">Provas</h2>
          <span className="ui-muted">{visible.size} de {races.length} no gráfico</span>
        </div>
        <div className="ui-card ui-list">
          {races.map((race, i) => {
            const color = COLORS[i % COLORS.length];
            const isOn = visible.has(i);
            const pace = getHalfRacePace(race);
            const closedKmPaces = race.splits
              .filter(isClosedKmSplit)
              .map((split) => split.paceSecPerKm)
              .filter((pace) => pace > 0 && pace < 900);
            const best = closedKmPaces.length ? Math.min(...closedKmPaces) : 0;
            const isBest = i === bestIndex;

            return (
              <button
                key={race.id}
                type="button"
                className="ui-row ui-row--btn meia-row"
                aria-pressed={isOn}
                onClick={() => toggleRace(i)}
                style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}
              >
                <span className={`meia-check${isOn ? " meia-check--on" : ""}`} style={isOn ? { background: color, borderColor: color } : undefined} aria-hidden="true">
                  {isOn ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0e0f11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                  ) : null}
                </span>
                <span className="ui-row__main" style={{ flex: 1 }}>
                  <span className="ui-row__title" style={{ whiteSpace: "normal" }}>
                    {cleanRaceName(race.name)}
                    {isBest ? <span className="ui-tag-accent"> · melhor pace</span> : null}
                  </span>
                  <span className="ui-muted" style={{ fontSize: 12 }}>
                    {[
                      formatShortDate(race.date),
                      formatDistanceKm(race.distanceKm),
                      best ? `melhor km ${formatPace(best)}` : null,
                      race.gearName ?? null,
                      race.splitSource === "estimated" ? "sem splits: linha pela média" : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="ui-row__side">
                  <span className="ui-row__value">{race.timeSec ? formatDuration(race.timeSec) : `${formatPace(pace)}/km`}</span>
                  {race.timeSec ? <span className="ui-muted">{formatPace(pace)}/km</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataset } from "chart.js";

export type QualityWorkout = {
  id: string;
  date: string;
  name: string;
  distKm: number;
  label: string;
  confidence: number;
  fcAvg: number | null;
  fcMax: number | null;
  elev: number;
  cal: number;
  kmSplits: { km: number; pace: number | null; fc: number | null }[];
};

type Props = {
  workouts: QualityWorkout[];
};

const TYPE_COLORS: Record<string, string> = {
  Intervalado: "#ef4444",
  Fartlek:     "#f97316",
  Tiro:        "#8b5cf6",
  Progressivo: "#10b981",
  "Tempo Run": "#3b82f6",
  Rodagem:     "#6b7280",
};

const TYPE_LABELS: Record<string, string> = {
  Intervalado: "Intervalado",
  Fartlek:     "Fartlek",
  Tiro:        "Tiro",
  Progressivo: "Progressivo",
  "Tempo Run": "Tempo Run",
  Rodagem:     "Rodagem",
};

function formatPace(v: number): string {
  const m = Math.floor(v);
  const s = Math.round((v - m) * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// ── Volume chart ─────────────────────────────────────────────────────────────
function VolumeChart({ workouts }: { workouts: QualityWorkout[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      if (cancelled || !ref.current) return;
      if (chart.current) (chart.current as { destroy: () => void }).destroy();

      const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
      const gridC = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickC = isDark ? "#9ca3af" : "#6b7280";

      // Group by month
      const months: Record<string, Record<string, number>> = {};
      workouts.forEach((w) => {
        const m = w.date.slice(0, 7);
        if (!months[m]) months[m] = {};
        months[m][w.label] = (months[m][w.label] || 0) + 1;
      });

      const labels = Object.keys(months).sort().map((m) =>
        new Date(m + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      );
      const keys = Object.keys(months).sort();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = Object.keys(TYPE_COLORS).map((tipo) => ({
        label: tipo,
        data: keys.map((m) => months[m][tipo] || 0),
        backgroundColor: TYPE_COLORS[tipo] + "cc",
        borderRadius: 4,
        stack: "stack",
      }));

      chart.current = new Chart(ref.current, {
        type: "bar",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: tickC, font: { size: 10 }, boxWidth: 10, padding: 8 },
            },
          },
          scales: {
            x: { stacked: true, ticks: { color: tickC, font: { size: 10 } }, grid: { color: gridC } },
            y: { stacked: true, ticks: { color: tickC, font: { size: 10 }, callback: (v: unknown) => `${v}x` }, grid: { color: gridC } },
          },
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [workouts]);

  useEffect(() => () => { if (chart.current) (chart.current as { destroy: () => void }).destroy(); }, []);

  return <canvas ref={ref} role="img" aria-label="Distribuição mensal de treinos de qualidade por tipo" />;
}

// ── FC trend chart ────────────────────────────────────────────────────────────
function FcTrendChart({ workouts }: { workouts: QualityWorkout[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      if (cancelled || !ref.current) return;
      if (chart.current) (chart.current as { destroy: () => void }).destroy();

      const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
      const gridC = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickC = isDark ? "#9ca3af" : "#6b7280";

      const sorted = [...workouts]
        .filter((w) => w.fcMax !== null)
        .sort((a, b) => a.date.localeCompare(b.date));

      chart.current = new Chart(ref.current, {
        type: "scatter",
        data: {
          datasets: Object.keys(TYPE_COLORS).map((tipo) => ({
            label: tipo,
            data: sorted
              .filter((w) => w.label === tipo)
              .map((w) => ({ x: new Date(w.date).getTime(), y: w.fcMax })),
            backgroundColor: TYPE_COLORS[tipo] + "cc",
            pointRadius: 5,
            pointHoverRadius: 7,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: tickC, font: { size: 10 }, boxWidth: 10, padding: 8 } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const w = sorted.filter((w) => w.label === ctx.dataset.label)[ctx.dataIndex];
                  return w ? `${w.name} (${formatDate(w.date)}): FC máx ${w.fcMax} bpm` : "";
                },
              },
            },
          },
          scales: {
            x: {
              type: "linear" as const,
              ticks: {
                color: tickC, font: { size: 10 },
                callback: (v: unknown) => {
                  return new Date(v as number).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
                },
              },
              grid: { color: gridC },
            },
            y: {
              min: 140, max: 195,
              ticks: { color: tickC, font: { size: 10 }, callback: (v: unknown) => `${v} bpm` },
              grid: { color: gridC },
            },
          },
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [workouts]);

  useEffect(() => () => { if (chart.current) (chart.current as { destroy: () => void }).destroy(); }, []);

  return <canvas ref={ref} role="img" aria-label="Evolução da FC máxima nos treinos de qualidade ao longo do tempo" />;
}

// ── Splits mini chart ─────────────────────────────────────────────────────────
function SplitsMiniChart({ splits, label }: { splits: QualityWorkout["kmSplits"]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<unknown>(null);

  const color = TYPE_COLORS[label] || "#6b7280";

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      if (cancelled || !ref.current || splits.length === 0) return;
      if (chart.current) (chart.current as { destroy: () => void }).destroy();

      const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
      const gridC = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const tickC = isDark ? "#9ca3af" : "#9ca3af";

      const validPaces = splits.map((s) => s.pace).filter((p): p is number => p !== null && p > 3 && p < 10);
      const paceMin = validPaces.length ? Math.min(...validPaces) * 0.97 : 4;
      const paceMax = validPaces.length ? Math.max(...validPaces) * 1.03 : 8;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = [
        {
          type: "bar" as const,
          label: "Pace",
          data: splits.map((s) => (s.pace && s.pace > 3 && s.pace < 10 ? s.pace : null)),
          backgroundColor: splits.map((s) => {
            if (!s.pace) return "#d1d5db";
            const avg = validPaces.reduce((a, b) => a + b, 0) / validPaces.length;
            return s.pace <= avg * 0.97 ? color : s.pace <= avg * 1.03 ? color + "99" : "#d1d5db";
          }),
          borderRadius: 3,
          yAxisID: "yPace",
          order: 2,
        },
      ];

      if (splits.some((s) => s.fc !== null)) {
        datasets.push({
          type: "line" as const,
          label: "FC",
          data: splits.map((s) => s.fc),
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          pointRadius: 2,
          tension: 0.4,
          yAxisID: "yHr",
          spanGaps: true,
          order: 1,
        });
      }

      chart.current = new Chart(ref.current, {
        type: "bar",
        data: { labels: splits.map((s) => `${s.km}km`), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "Pace") return `${formatPace(ctx.raw as number)}/km`;
                return `FC: ${ctx.raw} bpm`;
              },
            },
          }},
          scales: {
            x: { ticks: { color: tickC, font: { size: 9 }, autoSkip: true, maxRotation: 0 }, grid: { color: gridC } },
            yPace: { type: "linear" as const, position: "left" as const, reverse: true, min: paceMin, max: paceMax,
              ticks: { color: tickC, font: { size: 9 }, callback: (v: unknown) => formatPace(v as number) },
              grid: { color: gridC } },
            yHr: { type: "linear" as const, position: "right" as const,
              ticks: { color: "#ef4444", font: { size: 9 }, callback: (v: unknown) => `${v}` },
              grid: { display: false } },
          },
        },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [splits, label, color]);

  useEffect(() => () => { if (chart.current) (chart.current as { destroy: () => void }).destroy(); }, []);

  return <canvas ref={ref} role="img" aria-label={`Splits do treino de ${label}`} />;
}

// ── Main component ────────────────────────────────────────────────────────────
const ALL_TYPES = ["Todos", ...Object.keys(TYPE_COLORS)];

export default function QualityWorkoutsChart({ workouts }: Props) {
  const [filter, setFilter] = useState("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "Todos"
    ? workouts
    : workouts.filter((w) => w.label === filter);

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const counts = workouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.label] = (acc[w.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Object.entries(TYPE_COLORS).map(([tipo, color]) => (
          <button
            key={tipo}
            onClick={() => setFilter(filter === tipo ? "Todos" : tipo)}
            className={`rounded-2xl p-3 text-center transition-all ${
              filter === tipo ? "ring-2 shadow-sm" : "bg-white shadow-sm hover:shadow"
            }`}
            style={filter === tipo ? { outline: `2px solid ${color}`, background: color + "18" } : {}}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full mb-1"
              style={{ background: color }}
            />
            <p className="text-xs text-gray-500">{tipo}</p>
            <p className="text-lg font-bold text-gray-900">{counts[tipo] || 0}</p>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-900">Treinos por mês e tipo</p>
          <div className="relative h-48">
            <VolumeChart workouts={workouts} />
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-900">FC máxima por treino</p>
          <div className="relative h-48">
            <FcTrendChart workouts={workouts} />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === t
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 shadow-sm hover:bg-gray-50"
            }`}
          >
            {t}
            {t !== "Todos" && (
              <span className="ml-1.5 text-xs opacity-60">{counts[t] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* Workout list */}
      <div className="space-y-2">
        {sorted.map((w) => {
          const color = TYPE_COLORS[w.label] || "#6b7280";
          const isOpen = expanded === w.id;
          return (
            <div key={w.id} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : w.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: color }}
                    >
                      {w.label[0]}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{w.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: color }}
                        >
                          {TYPE_LABELS[w.label] || w.label}
                        </span>
                        {w.confidence < 0.85 && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                            auto-detectado
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{formatDate(w.date)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs text-gray-500">
                    <span className="font-mono font-medium text-gray-800">{w.distKm.toFixed(1)} km</span>
                    {w.fcAvg && <span>{w.fcAvg} bpm</span>}
                    {w.fcMax && (
                      <span className="font-medium" style={{ color }}>
                        máx {w.fcMax}
                      </span>
                    )}
                    <span className={`text-sm transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 p-4">
                  <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Elevação: {w.elev}m</span>
                    <span>Calorias: {w.cal} kcal</span>
                    {w.kmSplits.length > 0 && (
                      <span>
                        Melhor km:{" "}
                        <span className="font-semibold" style={{ color }}>
                          {formatPace(
                            Math.min(
                              ...w.kmSplits
                                .map((s) => s.pace)
                                .filter((p): p is number => p !== null && p > 3 && p < 10)
                            )
                          )}/km
                        </span>
                      </span>
                    )}
                  </div>

                  {w.kmSplits.length > 0 ? (
                    <div className="relative h-44">
                      <SplitsMiniChart splits={w.kmSplits} label={w.label} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Splits km a km não disponíveis para este treino.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">Nenhum treino do tipo "{filter}" encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

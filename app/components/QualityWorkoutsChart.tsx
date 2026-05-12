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
  // Add T12:00:00 to avoid UTC midnight shifting date by timezone
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
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
        new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
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
              .map((w) => ({ x: new Date(w.date + "T12:00:00").getTime(), y: w.fcMax })),
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

  // Per-type aggregated stats
  const typeStats = Object.keys(TYPE_COLORS).reduce<Record<string, {
    avgDist: number | null;
    avgFc: number | null;
    avgPace: number | null;
  }>>((acc, tipo) => {
    const group = workouts.filter((w) => w.label === tipo);
    if (group.length === 0) {
      acc[tipo] = { avgDist: null, avgFc: null, avgPace: null };
      return acc;
    }
    const dists = group.map((w) => w.distKm).filter((d) => d > 0);
    const fcs = group.map((w) => w.fcAvg).filter((f): f is number => f !== null);
    const paces = group.flatMap((w) =>
      w.kmSplits
        .map((s) => s.pace)
        .filter((p): p is number => p !== null && p > 3 && p < 10)
    );
    acc[tipo] = {
      avgDist: dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : null,
      avgFc: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null,
      avgPace: paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null,
    };
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="ba-grid-3" style={{ gridTemplateColumns: "repeat(6,1fr)", gap: ".7rem", marginBottom: "1rem" }}>
        {Object.entries(TYPE_COLORS).map(([tipo, color]) => {
          const stats = typeStats[tipo];
          const count = counts[tipo] || 0;
          const active = filter === tipo;
          return (
            <button
              key={tipo}
              onClick={() => setFilter(active ? "Todos" : tipo)}
              className="ba-card-soft"
              style={{ padding: ".85rem 1rem", textAlign: "left", cursor: "pointer", outline: active ? `1.5px solid ${color}` : "none", background: active ? color + "18" : undefined, transition: "all .15s" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)" }}>{tipo}</span>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", color: "#fff", lineHeight: 1 }}>{count}</p>
              {count > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", marginTop: 8, paddingTop: 8 }}>
                  {stats.avgDist !== null && <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 4 }}>dist <span style={{ color: "rgba(255,255,255,.65)" }}>{stats.avgDist.toFixed(1)} km</span></p>}
                  {stats.avgPace !== null && <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 4 }}>pace <span style={{ color: "rgba(255,255,255,.65)" }}>{formatPace(stats.avgPace)}/km</span></p>}
                  {stats.avgFc !== null && <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>FC <span style={{ color: "rgba(255,255,255,.65)" }}>{stats.avgFc} bpm</span></p>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="ba-grid-2">
        <div className="ba-card" style={{ padding: "1.2rem" }}>
          <p style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Treinos por mês e tipo</p>
          <div className="relative h-48">
            <VolumeChart workouts={workouts} />
          </div>
        </div>
        <div className="ba-card" style={{ padding: "1.2rem" }}>
          <p style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>FC máxima por treino</p>
          <div className="relative h-48">
            <FcTrendChart workouts={workouts} />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", justifyContent: "center", margin: "1rem 0" }}>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === t
                ? "ba-pill ba-pill-orange"
                : "ba-pill ba-pill-dark"
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
      <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
        {sorted.map((w) => {
          const color = TYPE_COLORS[w.label] || "#6b7280";
          const isOpen = expanded === w.id;
          return (
            <div key={w.id} className="ba-card-soft" style={{ overflow: "hidden" }}>
              <button
                className="w-full text-left" style={{ padding: "1.1rem 1.25rem", background: "transparent", cursor: "pointer" }}
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
                        <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{w.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: color }}
                        >
                          {TYPE_LABELS[w.label] || w.label}
                        </span>
                        {w.confidence < 0.85 && (
                          <span className="ba-pill ba-pill-dark" style={{ fontSize: 10, padding: "2px 8px" }}>
                            auto-detectado
                          </span>
                        )}
                      </div>
                      <p style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,.4)" }}>{formatDate(w.date)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", gap: 6, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text)" }}>{w.distKm.toFixed(1)} km</span>
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
                <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "1rem 1.15rem" }}>
                  <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
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
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>Splits km a km não disponíveis para este treino.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="ba-card" style={{ padding: "2rem", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>Nenhum treino do tipo &ldquo;{filter}&rdquo; encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

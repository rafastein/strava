"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartDataset } from "chart.js";
import { formatDayMonth, formatDuration, formatNumber } from "../lib/format";
import { applyChartTheme } from "../lib/chart-theme";

export type QualityWorkout = {
  id: string;
  date: string;
  name: string;
  distKm: number;
  label: string;
  confidence: number;
  classificationSource?: "coros" | "auto";
  plannedWorkoutTitle?: string | null;
  plannedWorkoutType?: string | null;
  fcAvg: number | null;
  fcMax: number | null;
  elev: number;
  cal: number;
  kmSplits: { km: number; pace: number | null; fc: number | null }[];
  laps?: {
    index: number;
    name: string;
    distKm: number;
    timeSec: number;
    paceMinPerKm: number | null;
    fcAvg: number | null;
    fcMax: number | null;
    speedKmh: number;
  }[];
};

type Props = {
  workouts: QualityWorkout[];
};

const TYPE_COLORS: Record<string, string> = {
  Intervalado: "#ef4444",
  Fartlek:     "#f97316",
  Progressivo: "#10b981",
  "Tempo Run": "#6aa8ff",
  Rodagem:     "#9ba1a9",
};

const TYPE_LABELS: Record<string, string> = {
  Intervalado: "Intervalado",
  Fartlek:     "Fartlek",
  Progressivo: "Progressivo",
  "Tempo Run": "Tempo Run",
  Rodagem:     "Rodagem",
};

function normalizeQualityType(label: string): string {
  return label === "Tiro" ? "Intervalado" : label;
}

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

// ── Volume chart ─────────────────────────────────────────────────────────────
function VolumeChart({ workouts }: { workouts: QualityWorkout[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      applyChartTheme(Chart);
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
      applyChartTheme(Chart);
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
      applyChartTheme(Chart);
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


function LapsTable({ laps, label }: { laps: NonNullable<QualityWorkout["laps"]>; label: string }) {
  const color = TYPE_COLORS[label] || "#9ba1a9";
  const speeds = laps.map((l) => l.speedKmh).filter((s) => s > 0);
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const FAST_THRESH = avgSpeed * 1.08; // 8% acima da média = volta forte

  function formatPaceStr(p: number | null) {
    if (!p || p < 3 || p > 12) return "—";
    return `${formatPace(p)}/km`;
  }

  return (
    <div>
      <p className="ui-muted" style={{ marginBottom: 8 }}>
        {laps.length} voltas · as fortes (8% acima da média) aparecem marcadas
      </p>
      <div className="quali-laps">
        {laps.map((lap) => {
          const isFast = lap.speedKmh >= FAST_THRESH;
          return (
            <div key={lap.index} className="quali-lap" style={isFast ? { borderColor: color, background: "var(--ui-surface-2)" } : undefined}>
              <span className="ui-muted" style={{ width: 20 }}>{lap.index}</span>
              <span className="quali-lap__pace" style={{ fontWeight: isFast ? 600 : 400, color: isFast ? "var(--ui-text)" : "var(--ui-text-2)" }}>
                {formatPaceStr(lap.paceMinPerKm)}
              </span>
              <span className="ui-muted">{formatNumber(lap.distKm, 2)} km</span>
              <span className="ui-muted" style={{ textAlign: "right" }}>{formatDuration(lap.timeSec)}</span>
              <span className="ui-muted" style={{ textAlign: "right" }}>{lap.fcAvg ? `${lap.fcAvg} bpm` : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QualityWorkoutsChart({ workouts }: Props) {
  const [filter, setFilter] = useState("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const normalizedWorkouts = workouts.map((workout) => ({
    ...workout,
    label: normalizeQualityType(workout.label),
  }));

  const filtered = filter === "Todos"
    ? normalizedWorkouts
    : normalizedWorkouts.filter((w) => w.label === filter);

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const counts = normalizedWorkouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.label] = (acc[w.label] || 0) + 1;
    return acc;
  }, {});

  // Médias por tipo
  const typeStats = Object.keys(TYPE_COLORS).reduce<Record<string, {
    avgDist: number | null;
    avgFc: number | null;
    avgPace: number | null;
  }>>((acc, tipo) => {
    const group = normalizedWorkouts.filter((w) => w.label === tipo);
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

  const activeTypes = Object.keys(TYPE_COLORS).filter((tipo) => (counts[tipo] || 0) > 0);

  return (
    <div className="hoje-col">
      {/* ── Por tipo: cada linha também filtra a lista ── */}
      <section className="ui-section" style={{ paddingTop: 0 }} aria-label="Por tipo de treino">
        <div className="ui-section__head">
          <h2 className="ui-h2">Por tipo</h2>
          <span className="ui-muted">toque para filtrar</span>
        </div>
        <div className="ui-card ui-list">
          {activeTypes.map((tipo) => {
            const stats = typeStats[tipo];
            const active = filter === tipo;
            return (
              <button
                key={tipo}
                type="button"
                className="ui-row ui-row--btn"
                aria-pressed={active}
                onClick={() => setFilter(active ? "Todos" : tipo)}
              >
                <span className="ui-row__main">
                  <span className="ui-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="carga-dot" style={{ background: TYPE_COLORS[tipo] }} />
                    {TYPE_LABELS[tipo] || tipo}
                  </span>
                  <span className="ui-muted">
                    {counts[tipo]} {counts[tipo] === 1 ? "treino" : "treinos"}
                    {stats.avgDist !== null ? ` · ${formatNumber(stats.avgDist, 1)} km em média` : ""}
                  </span>
                </span>
                <span className="ui-row__side">
                  <span className="ui-row__value">{stats.avgPace !== null ? `${formatPace(stats.avgPace)}/km` : "—"}</span>
                  <span className="ui-muted">{stats.avgFc !== null ? `${stats.avgFc} bpm` : ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Gráficos ── */}
      <div className="carga-grid">
        <section className="ui-card ui-card--pad ui-stack" aria-label="Treinos por mês e tipo">
          <h2 className="ui-h2">Treinos por mês</h2>
          <div style={{ position: "relative", height: 200 }}>
            <VolumeChart workouts={normalizedWorkouts} />
          </div>
        </section>
        {normalizedWorkouts.some((w) => w.fcMax) ? (
          <section className="ui-card ui-card--pad ui-stack" aria-label="FC máxima por treino">
            <h2 className="ui-h2">FC máxima por treino</h2>
            <div style={{ position: "relative", height: 200 }}>
              <FcTrendChart workouts={normalizedWorkouts} />
            </div>
          </section>
        ) : null}
      </div>

      {/* ── Lista ── */}
      <section className="ui-section" aria-label="Treinos">
        <div className="ui-section__head" style={{ alignItems: "center" }}>
          <h2 className="ui-h2">{filter === "Todos" ? "Todos os treinos" : TYPE_LABELS[filter] || filter}</h2>
          {filter !== "Todos" ? (
            <button type="button" className="ui-btn ui-btn--ghost" style={{ cursor: "pointer" }} onClick={() => setFilter("Todos")}>
              Ver todos
            </button>
          ) : (
            <span className="ui-muted">{sorted.length} treinos</span>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="ui-card ui-card--pad ui-muted">Nenhum treino deste tipo encontrado.</p>
        ) : (
          <div className="ui-card ui-list">
            {sorted.map((w) => {
              const color = TYPE_COLORS[w.label] || "#9ba1a9";
              const isOpen = expanded === w.id;
              const goodPaces = w.kmSplits.map((s) => s.pace).filter((p): p is number => p !== null && p > 3 && p < 10);
              const [day, month] = formatDayMonth(w.date).split(" ");
              return (
                <div key={w.id} className="ui-acc" data-open={isOpen ? "true" : undefined}>
                  <button
                    type="button"
                    className="ui-row ui-row--date ui-row--btn"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : w.id)}
                  >
                    <span className="ui-date">
                      <span className="ui-date__day">{day}</span>
                      <span className="ui-muted" style={{ fontSize: 12 }}>{month}</span>
                    </span>
                    <span className="ui-row__main">
                      <span className="ui-row__title">{w.name}</span>
                      <span className="ui-muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="carga-dot" style={{ background: color }} />
                        {[
                          TYPE_LABELS[w.label] || w.label,
                          w.classificationSource === "coros" ? "tipo do COROS" : w.confidence < 0.85 ? "detectado automaticamente" : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="ui-row__side">
                      <span className="ui-row__value">{formatNumber(w.distKm, 1)} km</span>
                      <span className="ui-muted">{w.fcMax ? `máx ${w.fcMax} bpm` : w.fcAvg ? `${w.fcAvg} bpm` : ""}</span>
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="ui-acc__body">
                      {w.plannedWorkoutTitle ? <p className="ui-muted">Planejado no COROS: {w.plannedWorkoutTitle}</p> : null}
                      <dl className="ui-dl">
                        <div><dt>FC média</dt><dd>{w.fcAvg ? `${w.fcAvg} bpm` : "—"}</dd></div>
                        <div><dt>FC máxima</dt><dd>{w.fcMax ? `${w.fcMax} bpm` : "—"}</dd></div>
                        <div><dt>Melhor km</dt><dd>{goodPaces.length ? `${formatPace(Math.min(...goodPaces))}/km` : "—"}</dd></div>
                        <div><dt>Subida</dt><dd>{formatNumber(w.elev)} m</dd></div>
                        <div><dt>Calorias</dt><dd>{w.cal ? `${formatNumber(w.cal)} kcal` : "—"}</dd></div>
                      </dl>

                      {w.laps && w.laps.length > 1 ? (
                        <LapsTable laps={w.laps} label={w.label} />
                      ) : w.kmSplits.length > 0 ? (
                        <div style={{ position: "relative", height: 180 }}>
                          <SplitsMiniChart splits={w.kmSplits} label={w.label} />
                        </div>
                      ) : (
                        <p className="ui-muted">Splits não disponíveis para este treino.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

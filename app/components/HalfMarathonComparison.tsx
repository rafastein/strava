"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataset } from "chart.js";

export type HalfMarathonEntry = {
  id: number;
  name: string;
  date: string;
  splits: { km: number; paceSecPerKm: number; heartrate: number | null }[];
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

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return iso.slice(0, 10); }
}

export default function HalfMarathonComparison({ races }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);
  const [visible, setVisible] = useState<Set<number>>(new Set(races.map((_, i) => i)));

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

    if (chartInstance.current) {
      (chartInstance.current as { destroy: () => void }).destroy();
      chartInstance.current = null;
    }

    const isDark = true; // site sempre dark
    const gridColor = "rgba(255,255,255,0.06)";
    const tickColor = "rgba(255,255,255,0.4)";

    const maxKm = Math.max(...races.map((r) => r.splits.length));
    const labels = Array.from({ length: maxKm }, (_, i) => `${i + 1}km`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: ChartDataset<any, any>[] = races
      .filter((_, i) => visible.has(i))
      .map((race, visIdx) => {
        const origIdx = races.indexOf(race);
        const color = COLORS[origIdx % COLORS.length];
        return {
          type: "line" as const,
          label: `${formatShortDate(race.date)} ${race.name}`,
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

    const paceMin = allPaces.length ? Math.min(...allPaces) * 0.98 : 4;
    const paceMax = allPaces.length ? Math.max(...allPaces) * 1.02 : 6.5;

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
            ticks: { color: tickColor, font: { size: 10 }, autoSkip: false, maxRotation: 45 },
            grid: { color: gridColor },
          },
          y: {
            reverse: true,
            min: paceMin,
            max: paceMax,
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (v: unknown) => {
                const val = typeof v === "number" ? v * 60 : 0;
                return formatPace(val);
              },
            },
            grid: { color: gridColor },
            title: { display: true, text: "min/km", color: tickColor, font: { size: 10 } },
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
    return (
      <div className="ba-card" style={{ padding: "1.5rem" }}>
        <p className="ba-muted">Nenhuma meia maratona com splits disponíveis.</p>
      </div>
    );
  }

  return (
    <div className="ba-card" style={{ padding: "1.5rem" }}>
      <div className="mb-4">
        <p className="ba-eyebrow">Comparativo de meias maratonas</p>
        <p className="ba-muted" style={{ marginTop: 4 }}>
          Splits km a km sobrepostos — clique para mostrar/ocultar cada prova.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {races.map((race, i) => {
          const color = COLORS[i % COLORS.length];
          const isOn = visible.has(i);
          return (
            <button
              key={race.id}
              onClick={() => toggleRace(i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity ${
                isOn ? "opacity-100" : "opacity-40"
              }`}
              style={{ borderColor: isOn ? color : "rgba(255,255,255,.15)", color: isOn ? color : "rgba(255,255,255,.35)" }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: isOn ? color : "rgba(255,255,255,.2)" }}
              />
              {formatShortDate(race.date)} {race.name}
            </button>
          );
        })}
      </div>

      <div className="relative h-72">
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Comparativo de splits km a km das meias maratonas"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <th style={{ paddingBottom: 8, textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Prova</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Data</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Dist</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Ritmo médio</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Melhor km</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race, i) => {
              const color = COLORS[i % COLORS.length];
              const validPaces = race.splits
                .map((s) => s.paceSecPerKm)
                .filter((p) => p > 0 && p < 900);
              const avg = validPaces.length
                ? validPaces.reduce((a, b) => a + b, 0) / validPaces.length
                : 0;
              const best = validPaces.length ? Math.min(...validPaces) : 0;
              return (
                <tr key={race.id} style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <td className="py-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: color }}
                      />
                      <span style={{ fontWeight: 500, color: "var(--text)", fontSize: 13 }}>{race.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-muted)", fontSize: 12 }}>{formatShortDate(race.date)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-muted)", fontSize: 12 }}>{race.splits.length} km</td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text)", fontSize: 12 }}>
                    {formatPace(avg)}/km
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 500, color: "#10b981", fontSize: 12 }}>
                    {formatPace(best)}/km
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

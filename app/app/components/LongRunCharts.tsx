"use client";

import { useEffect, useRef, useState } from "react";
import type { TooltipItem } from "chart.js";

export type LongRunChartEntry = {
  id: number | string;
  date: string;
  distanceKm: number;
  paceSecPerKm: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  efficiency: number | null;
};

type Props = {
  longRuns: LongRunChartEntry[];
};

function formatPace(secPerKm: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "-";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec === 60 ? 0 : sec).padStart(2, "0")}`;
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return dateStr.slice(0, 10);
  }
}

type ChartMode = "pace" | "heartrate" | "efficiency";

export default function LongRunCharts({ longRuns }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);
  const [mode, setMode] = useState<ChartMode>("pace");

  const sorted = [...longRuns].reverse();
  const labels = sorted.map((r) => formatShortDate(r.date));

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      if (cancelled || !chartRef.current) return;

      if (chartInstance.current) {
        (chartInstance.current as InstanceType<typeof Chart>).destroy();
        chartInstance.current = null;
      }

      const gridColor = "rgba(255,255,255,0.06)";
      const tickColor = "rgba(255,255,255,0.45)";
      const canvasBg = "#0d0d0d";

      let datasets: ConstructorParameters<typeof Chart>[1]["data"]["datasets"] =
        [];
      let scales: Record<string, unknown> = {};

      if (mode === "pace") {
        const paceData = sorted.map((r) =>
          r.paceSecPerKm ? r.paceSecPerKm / 60 : null
        );
        datasets = [
          {
            label: "Ritmo (min/km)",
            data: paceData,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: canvasBg,
            pointBorderWidth: 1.5,
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 },
            grid: { color: gridColor },
          },
          y: {
            reverse: true,
            min: 4.5,
            max: 7.0,
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (v: unknown) => {
                const val = typeof v === "number" ? v : 0;
                const m = Math.floor(val);
                const s = Math.round((val - m) * 60);
                return `${m}:${String(s).padStart(2, "0")}`;
              },
            },
            grid: { color: gridColor },
          },
        };
      } else if (mode === "heartrate") {
        datasets = [
          {
            label: "FC média",
            data: sorted.map((r) => r.averageHeartrate),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239,68,68,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: "#ef4444",
            spanGaps: true,
          },
          {
            label: "FC máxima",
            data: sorted.map((r) => r.maxHeartrate),
            borderColor: "#f97316",
            backgroundColor: "transparent",
            borderDash: [4, 3],
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: "#f97316",
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 },
            grid: { color: gridColor },
          },
          y: {
            min: 130,
            max: 195,
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (v: unknown) => `${v} bpm`,
            },
            grid: { color: gridColor },
          },
        };
      } else {
        datasets = [
          {
            label: "Eficiência",
            data: sorted.map((r) => r.efficiency),
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: sorted.map((r) =>
              r.efficiency && r.efficiency > 15 ? "#10b981" : "#6b7280"
            ),
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: tickColor,
              font: { size: 10 },
              callback: (v: unknown) =>
                typeof v === "number" ? v.toFixed(1) : v,
            },
            grid: { color: gridColor },
          },
        };
      }

      chartInstance.current = new Chart(chartRef.current, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: datasets.length > 1 },
            tooltip: {
              callbacks: {
                label: (ctx: TooltipItem<"line">) => {
                  if (mode === "pace") {
                    const val = ctx.raw as number | null;
                    if (!val) return "-";
                    const m = Math.floor(val);
                    const s = Math.round((val - m) * 60);
                    return `Ritmo: ${m}:${String(s).padStart(2, "0")} min/km`;
                  }
                  if (mode === "heartrate") {
                    return `${ctx.dataset.label}: ${ctx.raw} bpm`;
                  }
                  const val = ctx.raw as number | null;
                  return `Eficiência: ${val?.toFixed(3) ?? "-"}`;
                },
                afterLabel: (ctx: TooltipItem<"line">) => {
                  const run = sorted[ctx.dataIndex];
                  return `${run.distanceKm.toFixed(1)} km`;
                },
              },
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          scales: scales as any,
        },
      });
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [mode, sorted, labels]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (
          chartInstance.current as { destroy: () => void }
        ).destroy();
      }
    };
  }, []);

  const tabs: { key: ChartMode; label: string }[] = [
    { key: "pace", label: "Ritmo" },
    { key: "heartrate", label: "Freq. cardíaca" },
    { key: "efficiency", label: "Eficiência" },
  ];

  return (
    <div className="card long-run-chart-card" style={{ padding: "2rem" }}>
      <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between long-run-chart-header">
        <div>
          <h2 className="text-xl font-semibold text-white/90">
            Evolução dos longões
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {sorted.length} longões — do mais antigo ao mais recente
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[540px] long-run-chart-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`long-run-chart-tab min-w-[165px] rounded-full border px-7 py-3.5 text-center text-sm font-semibold leading-none transition-colors ${
                mode === tab.key
                  ? "bg-[rgba(245,166,35,0.18)] text-[#f5a623] border border-[rgba(245,166,35,0.3)]"
                  : "bg-white/[0.04] text-white/45 border border-white/10 hover:text-white/75"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[340px] long-run-chart-canvas">
        <canvas
          ref={chartRef}
          role="img"
          aria-label={`Gráfico de evolução de ${mode} nos longões`}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/35 long-run-chart-legend">
        {mode === "pace" && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Ritmo médio — menor = mais rápido
            </span>
          </>
        )}
        {mode === "heartrate" && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              FC média
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />
              FC máxima
            </span>
          </>
        )}
        {mode === "efficiency" && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Eficiência = velocidade ajustada / FC — maior é melhor
          </span>
        )}
      </div>
    </div>
  );
}

export { formatPace };

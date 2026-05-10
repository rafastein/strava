"use client";

import { useEffect, useRef } from "react";
import type { ChartDataset } from "chart.js";

export type WeekEntry = {
  label: string;
  planned: number;
  actual: number;
};

type Props = {
  weeks: WeekEntry[];
  title?: string;
};

export default function WeeklyPlanVsActualChart({ weeks, title }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!chartRef.current || weeks.length === 0) return;

      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      if (cancelled || !chartRef.current) return;
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = null;
      }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickColor = isDark ? "#9ca3af" : "#6b7280";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = [
        {
          type: "bar" as const,
          label: "Planejado (SisRUN)",
          data: weeks.map((w) => w.planned),
          backgroundColor: isDark ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)",
          borderColor: isDark ? "rgba(148,163,184,0.5)" : "rgba(148,163,184,0.7)",
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: "bar" as const,
          label: "Executado (Strava)",
          data: weeks.map((w) => w.actual),
          backgroundColor: weeks.map((w) => {
            const ratio = w.planned > 0 ? w.actual / w.planned : 1;
            if (ratio >= 0.9) return "#f97316";
            if (ratio >= 0.7) return "#fbbf24";
            return "#f87171";
          }),
          borderRadius: 4,
          order: 1,
        },
        {
          type: "line" as const,
          label: "Aderência %",
          data: weeks.map((w) =>
            w.planned > 0 ? Math.min((w.actual / w.planned) * 100, 130) : null
          ),
          borderColor: "#6366f1",
          backgroundColor: "transparent",
          pointRadius: 3,
          pointBackgroundColor: "#6366f1",
          tension: 0.4,
          spanGaps: true,
          yAxisID: "yPct",
          order: 0,
        },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: { labels: weeks.map((w) => w.label), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.dataset.label === "Aderência %") {
                    const v = ctx.raw as number | null;
                    return `Aderência: ${v?.toFixed(0) ?? "-"}%`;
                  }
                  return `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(1)} km`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45, autoSkip: false },
              grid: { color: gridColor },
            },
            y: {
              ticks: { color: tickColor, font: { size: 10 }, callback: (v: unknown) => `${v} km` },
              grid: { color: gridColor },
            },
            yPct: {
              position: "right" as const,
              min: 0,
              max: 130,
              ticks: {
                color: "#6366f1",
                font: { size: 10 },
                callback: (v: unknown) => `${v}%`,
              },
              grid: { display: false },
            },
          },
        },
      });
    }

    render();
    return () => { cancelled = true; };
  }, [weeks]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  const totalPlanned = weeks.reduce((s, w) => s + w.planned, 0);
  const totalActual = weeks.reduce((s, w) => s + w.actual, 0);
  const avgAdherence = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
  const weeksOnTarget = weeks.filter((w) => w.planned > 0 && w.actual / w.planned >= 0.9).length;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {title ?? "Planejado vs. executado"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">SisRUN x Strava por semana</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {totalActual.toFixed(0)} km feitos
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {totalPlanned.toFixed(0)} km planejados
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            avgAdherence >= 90 ? "bg-emerald-100 text-emerald-700" :
            avgAdherence >= 70 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {avgAdherence.toFixed(0)}% aderência média
          </span>
        </div>
      </div>

      <div className="relative h-64">
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Gráfico de volume semanal planejado vs executado com aderência"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" />
          Executado (≥90% da meta)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" />
          Executado (70–89%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          Executado (&lt;70%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" />
          Planejado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 border-b-2 border-indigo-400" />
          Aderência %
        </span>
      </div>

      {weeks.length > 0 && (
        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-400">Semanas no alvo</p>
              <p className="mt-1 font-bold text-gray-900">{weeksOnTarget}/{weeks.filter(w => w.planned > 0).length}</p>
            </div>
            <div>
              <p className="text-gray-400">Melhor semana</p>
              <p className="mt-1 font-bold text-gray-900">
                {Math.max(...weeks.map(w => w.actual)).toFixed(1)} km
              </p>
            </div>
            <div>
              <p className="text-gray-400">Média semanal</p>
              <p className="mt-1 font-bold text-gray-900">
                {(totalActual / Math.max(weeks.length, 1)).toFixed(1)} km
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

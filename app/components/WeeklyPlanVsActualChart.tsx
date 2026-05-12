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

      const isDark = true;
      const gridColor = "rgba(255,255,255,0.06)";
      const tickColor = "rgba(255,255,255,0.55)";

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
              ticks: { color: tickColor, font: { size: 9 }, maxRotation: 35, autoSkip: false },
              grid: { color: gridColor },
            },
            y: {
              ticks: { color: tickColor, font: { size: 9 }, callback: (v: unknown) => `${v} km` },
              grid: { color: gridColor },
            },
            yPct: {
              position: "right" as const,
              min: 0,
              max: 130,
              ticks: {
                color: "#6366f1",
                font: { size: 9 },
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
    <div className="rounded-[22px] border border-white/10 bg-[#151515] p-5 shadow-[0_18px_60px_rgba(0,0,0,.20)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            {title ?? "Planejado vs. executado"}
          </h2>
          <p className="mt-1 text-[12px] text-white/45">SisRUN x Strava por semana</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-[10px] font-semibold text-orange-300">
            {totalActual.toFixed(0)} km feitos
          </span>
          <span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] font-semibold text-white/60">
            {totalPlanned.toFixed(0)} km planejados
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            avgAdherence >= 90 ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300" :
            avgAdherence >= 70 ? "border border-amber-400/20 bg-amber-400/10 text-amber-300" :
            "border border-red-400/20 bg-red-400/10 text-red-300"
          }`}>
            {avgAdherence.toFixed(0)}% aderência média
          </span>
        </div>
      </div>

      <div className="relative h-60">
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Gráfico de volume semanal planejado vs executado com aderência"
        />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-3 text-[10px] text-white/32">
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
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/25" />
          Planejado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 border-b-2 border-indigo-400" />
          Aderência %
        </span>
      </div>

      {weeks.length > 0 && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-3">
          <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
            <div>
              <p className="text-white/32">Semanas no alvo</p>
              <p className="mt-1 font-semibold text-white/90">{weeksOnTarget}/{weeks.filter(w => w.planned > 0).length}</p>
            </div>
            <div>
              <p className="text-white/32">Melhor semana</p>
              <p className="mt-1 font-semibold text-white/90">
                {Math.max(...weeks.map(w => w.actual)).toFixed(1)} km
              </p>
            </div>
            <div>
              <p className="text-white/32">Média semanal</p>
              <p className="mt-1 font-semibold text-white/90">
                {(totalActual / Math.max(weeks.length, 1)).toFixed(1)} km
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

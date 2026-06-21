"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChartDataset } from "chart.js";

export type WeekEntry = {
  label: string;
  planned: number;
  actual: number;
};

type Props = {
  weeks: WeekEntry[];
  title?: string;
  subtitle?: string;
};

function getChartLabelParts(label: string) {
  const normalized = label.replace(/[–—]/g, '-');
  const [startRaw, endRaw] = normalized.split('-').map((part) => part.trim());

  if (!startRaw || !endRaw) return [label];

  return [startRaw, endRaw];
}

function getAdherence(week: WeekEntry) {
  if (week.planned <= 0) return 0;
  return (week.actual / week.planned) * 100;
}

function getWeekStatusClass(week: WeekEntry) {
  const adherence = getAdherence(week);

  if (week.planned <= 0) return "weekly-card--muted";
  if (adherence >= 90) return "weekly-card--success";
  if (adherence >= 70) return "weekly-card--warning";
  return "weekly-card--danger";
}

function getWeekMessage(week: WeekEntry) {
  if (week.planned <= 0) return "Sem volume planejado para esta semana.";

  const diff = week.actual - week.planned;

  if (diff >= 0) {
    return `Meta semanal cumprida. Excedente de ${diff.toFixed(1)} km.`;
  }

  return `Faltam ${Math.abs(diff).toFixed(1)} km para cumprir o planejado da semana.`;
}

function parseBrDatePart(value: string, fallbackYear: number) {
  const [day, month, year] = value.trim().split("/").map(Number);

  if (!day || !month) return null;

  return new Date(year || fallbackYear, month - 1, day, 12, 0, 0, 0);
}

function isCurrentWeekLabel(label: string) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const normalized = label.replace(/\s/g, "").replace(/[–—]/g, "-");
  const [startRaw, endRaw] = normalized.split("-");

  if (!startRaw || !endRaw) return false;

  const start = parseBrDatePart(startRaw, currentYear);
  const end = parseBrDatePart(endRaw, currentYear);

  if (!start || !end) return false;

  if (end.getTime() < start.getTime()) {
    end.setFullYear(end.getFullYear() + 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return now >= start && now <= end;
}

export default function WeeklyPlanVsActualChart({
  weeks,
  title = "Volume semanal — planejado vs. executado",
  subtitle = "SisRUN x Strava por semana",
}: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  const decoratedWeeks = useMemo(
    () =>
      weeks.map((week, index) => ({
        ...week,
        adherence: getAdherence(week),
        isCurrent: index === 0 || isCurrentWeekLabel(week.label),
        statusClass: getWeekStatusClass(week),
        message: getWeekMessage(week),
        chartLabel: getChartLabelParts(week.label),
      })),
    [weeks],
  );

  const totalPlanned = weeks.reduce((sum, week) => sum + week.planned, 0);
  const totalActual = weeks.reduce((sum, week) => sum + week.actual, 0);
  const avgAdherence = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
  const validWeeks = weeks.filter((week) => week.planned > 0);
  const weeksOnTarget = validWeeks.filter(
    (week) => week.actual / week.planned >= 0.9,
  ).length;
  const bestWeekKm = weeks.length
    ? Math.max(...weeks.map((week) => week.actual))
    : 0;
  const averageWeekKm = weeks.length ? totalActual / weeks.length : 0;

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

      const gridColor = "rgba(255,255,255,0.06)";
      const tickColor = "rgba(255,255,255,0.55)";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = [
        {
          type: "bar" as const,
          label: "Planejado",
          data: weeks.map((week) => week.planned),
          backgroundColor: "rgba(148,163,184,0.25)",
          borderColor: "rgba(148,163,184,0.5)",
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: "bar" as const,
          label: "Executado (Strava)",
          data: weeks.map((week) => week.actual),
          backgroundColor: weeks.map((week) => {
            const ratio = week.planned > 0 ? week.actual / week.planned : 1;

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
          data: weeks.map((week) =>
            week.planned > 0
              ? Math.min((week.actual / week.planned) * 100, 130)
              : null,
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
        data: {
          labels: decoratedWeeks.map((week) => week.chartLabel),
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.dataset.label === "Aderência %") {
                    const value = ctx.raw as number | null;
                    return `Aderência: ${value?.toFixed(0) ?? "-"}%`;
                  }

                  return `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(1)} km`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: tickColor,
                font: { size: 10 },
                maxRotation: 0,
                minRotation: 0,
                autoSkip: false,
                padding: 6,
              },
              grid: { color: gridColor },
            },
            y: {
              ticks: {
                color: tickColor,
                font: { size: 10 },
                padding: 6,
                callback: (value: unknown) => `${value} km`,
              },
              grid: { color: gridColor },
            },
            yPct: {
              position: "right" as const,
              min: 0,
              max: 130,
              ticks: {
                color: "#6366f1",
                font: { size: 10 },
                padding: 6,
                callback: (value: unknown) => `${value}%`,
              },
              grid: { display: false },
            },
          },
        },
      });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [decoratedWeeks, weeks]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return (
    <div className="weekly-plan-card rounded-[22px] border border-white/10 bg-[#151515] p-5 shadow-[0_18px_60px_rgba(0,0,0,.20)]">
      <div className="weekly-plan-card__header mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="weekly-plan-card__heading">
          <p className="ba-label">Planejado × executado</p>
          <h2 className="mt-2 text-[22px] font-extrabold leading-tight text-white">
            {title}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {subtitle}
          </p>
        </div>

        <div className="weekly-plan-card__badges grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[440px]">
          <span className="weekly-plan-badge weekly-plan-badge--actual rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-center text-[11px] font-semibold text-orange-300">
            {totalActual.toFixed(0)} km feitos
          </span>

          <span className="weekly-plan-badge weekly-plan-badge--planned rounded-2xl border border-white/10 bg-white/[.04] px-3 py-2 text-center text-[11px] font-semibold text-white/70">
            {totalPlanned.toFixed(0)} km planejados
          </span>

          <span
            className={`weekly-plan-badge rounded-2xl px-3 py-2 text-center text-[11px] font-semibold ${
              avgAdherence >= 90
                ? "weekly-plan-badge--success border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : avgAdherence >= 70
                  ? "weekly-plan-badge--warning border border-amber-400/20 bg-amber-400/10 text-amber-300"
                  : "weekly-plan-badge--danger border border-red-400/20 bg-red-400/10 text-red-300"
            }`}
          >
            {avgAdherence.toFixed(0)}% aderência média
          </span>
        </div>
      </div>

      <div className="weekly-chart-area relative h-[320px] rounded-2xl border border-white/5 bg-black/10 p-3 md:h-[360px]">
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Gráfico de volume semanal planejado vs executado com aderência"
        />
      </div>

      <div className="weekly-current-list">
        {decoratedWeeks.map((week) => (
          <article
            key={week.label}
            className={[
              "weekly-progress-card",
              week.statusClass,
              week.isCurrent ? "weekly-progress-card--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="weekly-progress-card__header">
              <div>
                <div className="weekly-progress-card__title-row">
                  <h3>{week.label}</h3>
                  {week.isCurrent && <span>Semana atual</span>}
                </div>
                <p>Progresso real</p>
              </div>

              <div className="weekly-progress-card__summary">
                <strong>
                  {week.actual.toFixed(1)} / {week.planned.toFixed(1)} km
                </strong>
                <span>{week.adherence.toFixed(0)}% de aderência</span>
              </div>
            </div>

            <div className="weekly-progress-card__bar">
              <div style={{ width: `${Math.min(week.adherence, 100)}%` }} />
            </div>

            <div className="weekly-progress-card__metrics">
              <div>
                <span>Planejado</span>
                <strong>{week.planned.toFixed(1)} km</strong>
              </div>

              <div>
                <span>Executado</span>
                <strong>{week.actual.toFixed(1)} km</strong>
              </div>

              <div>
                <span>Aderência</span>
                <strong>{week.adherence.toFixed(0)}%</strong>
              </div>
            </div>

            <p className="weekly-progress-card__message">{week.message}</p>
          </article>
        ))}
      </div>

      <div className="weekly-plan-card__legend mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[10px] text-white/40">
        <span className="flex items-center gap-1">
          <i className="weekly-legend-square weekly-legend-square--actual inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" />
          Executado ≥90%
        </span>

        <span className="flex items-center gap-1">
          <i className="weekly-legend-square weekly-legend-square--warning inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" />
          Executado 70–89%
        </span>

        <span className="flex items-center gap-1">
          <i className="weekly-legend-square weekly-legend-square--danger inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          Executado &lt;70%
        </span>

        <span className="flex items-center gap-1">
          <i className="weekly-legend-square weekly-legend-square--planned inline-block h-2.5 w-2.5 rounded-sm bg-white/25" />
          Planejado
        </span>

        <span className="flex items-center gap-1">
          <i className="weekly-legend-line inline-block h-2 w-3 border-b-2 border-indigo-400" />
          Aderência %
        </span>
      </div>

      {weeks.length > 0 && (
        <div className="weekly-plan-card__summary-grid mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-3">
          <div className="grid grid-cols-1 gap-3 text-center text-[11px] sm:grid-cols-3">
            <div>
              <p className="text-white/30">Semanas no alvo</p>
              <p className="mt-1 text-[12px] font-semibold text-white/88">
                {weeksOnTarget}/{validWeeks.length}
              </p>
            </div>

            <div>
              <p className="text-white/30">Melhor semana</p>
              <p className="mt-1 text-[12px] font-semibold text-white/88">
                {bestWeekKm.toFixed(1)} km
              </p>
            </div>

            <div>
              <p className="text-white/30">Média semanal</p>
              <p className="mt-1 text-[12px] font-semibold text-white/88">
                {averageWeekKm.toFixed(1)} km
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChartDataset, Plugin } from "chart.js";
import WeeklyPlanLegend from "./WeeklyPlanLegend";
import WeeklyPlanSummary from "./WeeklyPlanSummary";
import WeeklyProgressCards from "./WeeklyProgressCards";
import {
  decorateWeeks,
  getOrderedWeekdays,
  PLANNED_SEGMENT_COLORS,
  type DecoratedWeekEntry,
  type WeekEntry,
} from "./weekly-plan-utils";

export type { WeekEntry } from "./weekly-plan-utils";

type Props = {
  weeks: WeekEntry[];
  title?: string;
  subtitle?: string;
};

type MixedDataset = ChartDataset<"bar" | "line", (number | null)[]>;

function buildPlannedDatasets(decoratedWeeks: DecoratedWeekEntry[], stackedWeekdays: string[]): MixedDataset[] {
  return stackedWeekdays.map((day, index) => ({
    type: "bar" as const,
    label: `Planejado · ${day}`,
    data: decoratedWeeks.map((week) => {
      const segment = week.plannedSegments.find((item) => item.dayLabel === day);
      return segment?.distance ?? 0;
    }),
    backgroundColor: PLANNED_SEGMENT_COLORS[index % PLANNED_SEGMENT_COLORS.length],
    borderColor: "rgba(148,163,184,0.55)",
    borderWidth: 1,
    borderRadius: 4,
    stack: "planned",
    order: 2,
  }));
}

function getActualBarColor(week: WeekEntry) {
  const ratio = week.planned > 0 ? week.actual / week.planned : 1;

  if (ratio >= 0.9) return "#f97316";
  if (ratio >= 0.7) return "#fbbf24";

  return "#f87171";
}

function buildDatasets(weeks: WeekEntry[], decoratedWeeks: DecoratedWeekEntry[], stackedWeekdays: string[]): MixedDataset[] {
  return [
    ...buildPlannedDatasets(decoratedWeeks, stackedWeekdays),
    {
      type: "bar" as const,
      label: "Executado (Strava)",
      data: decoratedWeeks.map((week) => week.actual),
      backgroundColor: weeks.map(getActualBarColor),
      borderRadius: 4,
      stack: "actual",
      order: 1,
    },
    {
      type: "line" as const,
      label: "Aderência %",
      data: decoratedWeeks.map((week) => (week.planned > 0 ? Math.min((week.actual / week.planned) * 100, 130) : null)),
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
}

const plannedSegmentLabelsPlugin: Plugin = {
  id: "planned-segment-labels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const datasets = chart.data.datasets;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    datasets.forEach((dataset, datasetIndex) => {
      if (!String(dataset.label).startsWith("Planejado · ")) return;

      const dayLabel = String(dataset.label).replace("Planejado · ", "");
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((element, dataIndex) => {
        const value = Number(dataset.data?.[dataIndex] ?? 0);
        if (!Number.isFinite(value) || value <= 0) return;

        const props = element.getProps(["x", "y", "base"], true) as { x: number; y: number; base: number };
        const height = Math.abs(props.base - props.y);
        if (height < 22) return;

        const centerY = props.y + (props.base - props.y) / 2;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        if (height >= 34) {
          ctx.font = "600 10px Inter, sans-serif";
          ctx.fillText(dayLabel, props.x, centerY - 6);
          ctx.font = "500 9px Inter, sans-serif";
          ctx.fillText(`${value.toFixed(1)} km`, props.x, centerY + 7);
        } else {
          ctx.font = "600 9px Inter, sans-serif";
          ctx.fillText(`${dayLabel} ${value.toFixed(1)}`, props.x, centerY);
        }
      });
    });

    ctx.restore();
  },
};

export default function WeeklyPlanVsActualChart({
  weeks,
  title = "Volume semanal — planejado vs. executado",
  subtitle = "SisRUN x Strava por semana",
}: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  const decoratedWeeks = useMemo(() => decorateWeeks(weeks), [weeks]);
  const stackedWeekdays = useMemo(() => [...getOrderedWeekdays(weeks)].reverse(), [weeks]);

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
      const datasets = buildDatasets(weeks, decoratedWeeks, stackedWeekdays);

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: decoratedWeeks.map((week) => week.chartLabel),
          datasets,
        },
        plugins: [plannedSegmentLabelsPlugin],
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

                  if (String(ctx.dataset.label).startsWith("Planejado · ")) {
                    const day = String(ctx.dataset.label).replace("Planejado · ", "");
                    return `Planejado · ${day}: ${(ctx.raw as number).toFixed(1)} km`;
                  }

                  return `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(1)} km`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
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
              stacked: true,
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
  }, [decoratedWeeks, stackedWeekdays, weeks]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return (
    <div className="weekly-plan-card">
      <div className="weekly-plan-card__header">
        <div className="ba-compact-head">
          <div>
            <p className="ba-label">Planejado × executado</p>
            <h2 className="ba-compact-title">{title}</h2>
            <p className="ba-muted ba-compact-subtitle">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="weekly-chart-area">
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Gráfico de volume semanal planejado vs executado com aderência"
        />
      </div>

      <WeeklyProgressCards weeks={decoratedWeeks} />
      <WeeklyPlanLegend />
      <WeeklyPlanSummary weeks={weeks} />
    </div>
  );
}

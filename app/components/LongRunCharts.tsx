"use client";

import { useEffect, useRef, useState } from "react";
import type { TooltipItem } from "chart.js";
import { applyChartTheme } from "../lib/chart-theme";

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
      applyChartTheme(Chart);

      if (cancelled || !chartRef.current) return;

      if (chartInstance.current) {
        (chartInstance.current as InstanceType<typeof Chart>).destroy();
        chartInstance.current = null;
      }

      const gridColor = "#262a2f";
      const tickColor = "#9ba1a9";
      const canvasBg = "#17191c";

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
            borderColor: "#6aa8ff",
            backgroundColor: "rgba(106,168,255,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: "#6aa8ff",
            pointBorderColor: canvasBg,
            pointBorderWidth: 1.5,
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 12 }, maxRotation: 0 },
            grid: { color: gridColor },
          },
          y: {
            reverse: true,
            min: 4.5,
            max: 7.0,
            ticks: {
              color: tickColor,
              font: { size: 12 },
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
            borderColor: "#ff8a7a",
            backgroundColor: "rgba(255,138,122,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: "#ff8a7a",
            spanGaps: true,
          },
          {
            label: "FC máxima",
            data: sorted.map((r) => r.maxHeartrate),
            borderColor: "#f5a623",
            backgroundColor: "transparent",
            borderDash: [4, 3],
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: "#f5a623",
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 12 }, maxRotation: 0 },
            grid: { color: gridColor },
          },
          y: {
            min: 130,
            max: 195,
            ticks: {
              color: tickColor,
              font: { size: 12 },
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
            borderColor: "#3ddc97",
            backgroundColor: "rgba(61,220,151,0.08)",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: sorted.map((r) =>
              r.efficiency && r.efficiency > 15 ? "#3ddc97" : "#6b7280"
            ),
            spanGaps: true,
          },
        ];
        scales = {
          x: {
            ticks: { color: tickColor, font: { size: 12 }, maxRotation: 0 },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: tickColor,
              font: { size: 12 },
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
    { key: "heartrate", label: "FC" },
    { key: "efficiency", label: "Eficiência" },
  ];

  return (
    <div className="ui-card ui-card--pad ui-stack">
      <div className="ui-section__head" style={{ padding: 0, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 className="ui-h2">Evolução</h2>
          <p className="ui-muted">{sorted.length} longões, do mais antigo ao mais recente</p>
        </div>
        <div className="ui-seg" role="group" aria-label="Métrica do gráfico">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className="ui-seg__item" aria-pressed={mode === tab.key} onClick={() => setMode(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="long-run-chart-canvas" style={{ position: "relative", height: 280 }}>
        <canvas
          ref={chartRef}
          role="img"
          aria-label={`Gráfico de evolução de ${mode} nos longões`}
        />
      </div>
      <div className="carga-legend">
        {mode === "pace" && (
          <>
            <span className="carga-legend__item">
              <span className="carga-dot" style={{ background: "#6aa8ff" }} />
              Ritmo médio — menor = mais rápido
            </span>
          </>
        )}
        {mode === "heartrate" && (
          <>
            <span className="carga-legend__item">
              <span className="carga-dot" style={{ background: "#ff8a7a" }} />
              FC média
            </span>
            <span className="carga-legend__item">
              <span className="carga-dot" style={{ background: "#f5a623" }} />
              FC máxima
            </span>
          </>
        )}
        {mode === "efficiency" && (
          <span className="carga-legend__item">
            <span className="carga-dot" style={{ background: "#3ddc97" }} />
            Eficiência = velocidade ajustada / FC — maior é melhor
          </span>
        )}
      </div>
    </div>
  );
}

export { formatPace };

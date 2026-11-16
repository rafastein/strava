"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataset } from "chart.js";
import { applyChartTheme } from "../lib/chart-theme";

type SplitEntry = {
  km: number;
  paceSecPerKm: number;
  paceMinPerKm: number;
  heartrate: number | null;
  elevationDiff: number;
  distanceM: number;
};

type Props = {
  activityId: number;
  activityName?: string;
  targetPaceSecPerKm?: number | null;
  goalPaceSecPerKm?: number | null;
};

function formatPace(secPerKm: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "-";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function getPaceColor(paceSecPerKm: number, avgPace: number): string {
  if (paceSecPerKm <= avgPace * 0.97) return "#3ddc97";
  if (paceSecPerKm <= avgPace * 1.03) return "#6aa8ff";
  return "#6b727c";
}

export default function ActivitySplitsChart({
  activityId,
  activityName,
  targetPaceSecPerKm,
  goalPaceSecPerKm,
}: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);
  const [splits, setSplits] = useState<SplitEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchAndRender = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/strava/splits?id=${activityId}`);
      if (!res.ok) throw new Error("Erro ao buscar splits");
      const data = await res.json();
      setSplits(data.splits ?? []);
      setLoaded(true);
    } catch {
      setError("Não foi possível carregar os splits.");
    } finally {
      setLoading(false);
    }
  }, [activityId, loaded]);

  useEffect(() => {
    if (!splits || splits.length === 0 || !chartRef.current) return;

    let cancelled = false;

    async function render() {
      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      applyChartTheme(Chart);
      if (cancelled || !chartRef.current || !splits) return;

      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = null;
      }

      const gridColor = "#262a2f";
      const tickColor = "#9ba1a9";
      const canvasBg = "#17191c";

      const validPaces = splits
        .map((s) => s.paceSecPerKm)
        .filter((p) => p > 0 && p < 1200);
      const avgPace =
        validPaces.length > 0
          ? validPaces.reduce((a, b) => a + b, 0) / validPaces.length
          : 360;

      const paceMin = Math.min(...validPaces) * 0.97;
      const paceMax = Math.max(...validPaces) * 1.03;

      const labels = splits.map((s) =>
        s.distanceM < 900 ? `~${s.distanceM}m` : `${s.km}km`
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = [
        {
          type: "bar" as const,
          label: "Ritmo (min/km)",
          data: splits.map((s) =>
            s.paceSecPerKm > 0 && s.paceSecPerKm < 1200
              ? s.paceMinPerKm
              : null
          ),
          backgroundColor: splits.map((s) =>
            getPaceColor(s.paceSecPerKm, avgPace)
          ),
          borderRadius: 4,
          yAxisID: "yPace",
          order: 2,
        },
      ];

      const hasHr = splits.some((s) => s.heartrate !== null);
      if (hasHr) {
        datasets.push({
          type: "line" as const,
          label: "FC (bpm)",
          data: splits.map((s) => s.heartrate),
          borderColor: "#ff8a7a",
          backgroundColor: "transparent",
          pointRadius: 3,
          pointBackgroundColor: "#ff8a7a",
          pointBorderColor: canvasBg,
          pointBorderWidth: 1.5,
          tension: 0.4,
          yAxisID: "yHr",
          order: 1,
          spanGaps: true,
        });
      }

      // Linha de média da corrida
      datasets.push({
        type: "line" as const,
        label: "Média da corrida",
        data: splits.map(() => avgPace / 60),
        borderColor: "#c9cdd3",
        backgroundColor: "transparent",
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0,
        yAxisID: "yPace",
        order: 0,
      });

      // Linha de meta (Buenos Aires)
      if (goalPaceSecPerKm && goalPaceSecPerKm > 0) {
        datasets.push({
          type: "line" as const,
          label: "Pace alvo",
          data: splits.map(() => goalPaceSecPerKm / 60),
          borderColor: "#f5a623",
          backgroundColor: "transparent",
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0,
          yAxisID: "yPace",
          order: 0,
        });
      }

      const scales: Record<string, object> = {
        x: {
          ticks: {
            color: tickColor,
            font: { size: 12 },
            maxRotation: 45,
            autoSkip: false,
          },
          grid: { color: gridColor },
        },
        yPace: {
          type: "linear" as const,
          position: "left" as const,
          reverse: true,
          min: paceMin / 60,
          max: paceMax / 60,
          ticks: {
            color: tickColor,
            font: { size: 12 },
            callback: (v: unknown) => {
              const val = typeof v === "number" ? v * 60 : 0;
              return formatPace(val);
            },
          },
          grid: { color: gridColor },
          title: {
            display: true,
            text: "min/km",
            color: tickColor,
            font: { size: 12 },
          },
        },
      };

      if (hasHr) {
        const hrValues = splits
          .map((s) => s.heartrate)
          .filter((h): h is number => h !== null);
        scales["yHr"] = {
          type: "linear" as const,
          position: "right" as const,
          min: Math.min(...hrValues) - 5,
          max: Math.max(...hrValues) + 5,
          ticks: {
            color: "#ff8a7a",
            font: { size: 12 },
            callback: (v: unknown) => `${v} bpm`,
          },
          grid: { display: false },
          title: {
            display: true,
            text: "bpm",
            color: "#ff8a7a",
            font: { size: 12 },
          },
        };
      }

      chartInstance.current = new Chart(chartRef.current!, {
        type: "bar",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.dataset.label === "Ritmo (min/km)") {
                    const val = ctx.raw as number | null;
                    if (!val) return "-";
                    return `Ritmo: ${formatPace(val * 60)} min/km`;
                  }
                  if (ctx.dataset.label === "FC (bpm)") {
                    return `FC: ${ctx.raw} bpm`;
                  }
                  if (ctx.dataset.label === "Média da corrida") {
                    const val = ctx.raw as number | null;
                    if (!val) return "-";
                    return `Média: ${formatPace(val * 60)} min/km`;
                  }
                  if (ctx.dataset.label === "Meta BsAs") {
                    const val = ctx.raw as number | null;
                    if (!val) return "-";
                    return `Meta BsAs: ${formatPace(val * 60)} min/km`;
                  }
                  return String(ctx.raw);
                },
                afterLabel: (ctx) => {
                  if (ctx.datasetIndex !== 0) return "";
                  const s = splits![ctx.dataIndex];
                  const elev = s.elevationDiff;
                  if (elev === 0) return "";
                  return `Elevação: ${elev > 0 ? "+" : ""}${elev}m`;
                },
              },
            },
          },
          scales,
        },
      });
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [splits, targetPaceSecPerKm, goalPaceSecPerKm]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  if (!loaded && !loading) {
    return (
      <button
        onClick={fetchAndRender}
        type="button"
        className="ui-btn ui-btn--ghost"
        style={{ cursor: "pointer", alignSelf: "flex-start" }}
        aria-label={`Ver splits km a km de ${activityName ?? "atividade"}`}
      >
        Ver splits
      </button>
    );
  }

  if (loading) {
    return <p className="ui-muted" role="status" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>Carregando splits…</p>;
  }

  if (error) {
    return (
      <p role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 14, color: "#ff8a7a" }}>
        {error}
        <button type="button" className="ui-btn ui-btn--ghost" style={{ cursor: "pointer" }} onClick={() => { setLoaded(false); fetchAndRender(); }}>
          Tentar de novo
        </button>
      </p>
    );
  }

  if (!splits || splits.length === 0) {
    return <p className="ui-muted">Splits não disponíveis para esta atividade.</p>;
  }

  const validPaces = splits.map((s) => s.paceSecPerKm).filter((p) => p > 0 && p < 1200);
  const avgPace = validPaces.length > 0
    ? validPaces.reduce((a, b) => a + b, 0) / validPaces.length
    : 0;
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) : 0;
  const hasHr = splits.some((s) => s.heartrate !== null);

  return (
    <div className="splits-box">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h4 style={{ fontSize: 15, fontWeight: 600 }}>Km a km</h4>
        <span className="ui-muted">
          média {formatPace(avgPace)}/km · melhor km {formatPace(bestPace)}/km
          {goalPaceSecPerKm ? ` · alvo ${formatPace(goalPaceSecPerKm)}/km` : ""}
        </span>
      </div>

      <div style={{ position: "relative", height: 240 }}>
        <canvas ref={chartRef} role="img" aria-label={`Splits km a km de ${activityName ?? "atividade"}`} />
      </div>

      <div className="carga-legend" style={{ fontSize: 12 }}>
        <span className="carga-legend__item"><span className="carga-dot" style={{ background: "#3ddc97" }} />mais rápido que a média</span>
        <span className="carga-legend__item"><span className="carga-dot" style={{ background: "#6aa8ff" }} />na média</span>
        <span className="carga-legend__item"><span className="carga-dot" style={{ background: "#6b727c" }} />mais lento</span>
        <span className="carga-legend__item"><span className="carga-legend__line" style={{ background: "#c9cdd3" }} />média</span>
        {hasHr ? <span className="carga-legend__item"><span className="carga-legend__line" style={{ background: "#ff8a7a" }} />FC</span> : null}
        {goalPaceSecPerKm ? <span className="carga-legend__item"><span className="carga-legend__line" style={{ background: "#f5a623" }} />pace alvo</span> : null}
      </div>
    </div>
  );
}

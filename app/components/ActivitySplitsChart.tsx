"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChartDataset } from "chart.js";

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
};

function formatPace(secPerKm: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "-";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function getPaceColor(paceSecPerKm: number, avgPace: number): string {
  if (paceSecPerKm <= avgPace * 0.97) return "#10b981";
  if (paceSecPerKm <= avgPace * 1.03) return "#3b82f6";
  return "#6b7280";
}

export default function ActivitySplitsChart({
  activityId,
  activityName,
  targetPaceSecPerKm,
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
      if (cancelled || !chartRef.current || !splits) return;

      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = null;
      }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickColor = isDark ? "#9ca3af" : "#6b7280";

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
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          pointRadius: 3,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: isDark ? "#1f2937" : "#fff",
          pointBorderWidth: 1.5,
          tension: 0.4,
          yAxisID: "yHr",
          order: 1,
          spanGaps: true,
        });
      }

      if (targetPaceSecPerKm && targetPaceSecPerKm > 0) {
        datasets.push({
          type: "line" as const,
          label: "Meta",
          data: splits.map(() => targetPaceSecPerKm / 60),
          borderColor: "#f97316",
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
            font: { size: 10 },
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
            font: { size: 10 },
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
            font: { size: 10 },
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
            color: "#ef4444",
            font: { size: 10 },
            callback: (v: unknown) => `${v} bpm`,
          },
          grid: { display: false },
          title: {
            display: true,
            text: "bpm",
            color: "#ef4444",
            font: { size: 10 },
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
                  if (ctx.dataset.label === "Meta") {
                    const val = ctx.raw as number | null;
                    if (!val) return "-";
                    return `Meta: ${formatPace(val * 60)} min/km`;
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
  }, [splits, targetPaceSecPerKm]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  if (!loaded && !loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Splits km a km
            </p>
            {activityName && (
              <p className="text-xs text-gray-400">{activityName}</p>
            )}
          </div>
          <button
            onClick={fetchAndRender}
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Ver splits
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Carregando splits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => { setLoaded(false); fetchAndRender(); }}
          className="mt-2 text-xs text-red-500 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!splits || splits.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Splits não disponíveis para esta atividade.</p>
      </div>
    );
  }

  const validPaces = splits.map((s) => s.paceSecPerKm).filter((p) => p > 0 && p < 1200);
  const avgPace = validPaces.length > 0
    ? validPaces.reduce((a, b) => a + b, 0) / validPaces.length
    : 0;
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) : 0;
  const hasHr = splits.some((s) => s.heartrate !== null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Splits km a km
          </p>
          {activityName && (
            <p className="text-xs text-gray-400">{activityName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span>
            Ritmo médio:{" "}
            <span className="font-semibold text-gray-800">
              {formatPace(avgPace)}/km
            </span>
          </span>
          <span>
            Melhor km:{" "}
            <span className="font-semibold text-emerald-600">
              {formatPace(bestPace)}/km
            </span>
          </span>
          {targetPaceSecPerKm && (
            <span>
              <span className="inline-block h-2 w-4 border-b-2 border-dashed border-orange-400 align-middle" />{" "}
              Meta: {formatPace(targetPaceSecPerKm)}/km
            </span>
          )}
        </div>
      </div>

      <div className="relative h-56">
        <canvas
          ref={chartRef}
          role="img"
          aria-label={`Splits km a km de ${activityName ?? "atividade"}`}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Acima da média
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Na média
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-400" />
          Abaixo da média
        </span>
        {hasHr && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            Frequência cardíaca
          </span>
        )}
      </div>
    </div>
  );
}

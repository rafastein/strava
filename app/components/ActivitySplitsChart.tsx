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
  if (paceSecPerKm <= avgPace * 0.97) return "#10b981";
  if (paceSecPerKm <= avgPace * 1.03) return "#3b82f6";
  return "#6b7280";
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
      if (cancelled || !chartRef.current || !splits) return;

      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = null;
      }

      const gridColor = "rgba(255,255,255,0.06)";
      const tickColor = "rgba(255,255,255,0.45)";
      const canvasBg = "#0d0d0d";

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
        borderColor: "#6366f1",
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
          label: "Meta BsAs",
          data: splits.map(() => goalPaceSecPerKm / 60),
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
        className="w-full rounded-md border border-orange-400/35 bg-orange-400/[0.10] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] leading-none text-orange-100 transition-colors hover:bg-orange-400/[0.18] md:w-[150px]"
        aria-label={`Ver splits km a km de ${activityName ?? "atividade"}`}
      >
        Ver splits
      </button>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] md:col-span-2" style={{ padding: "0.95rem" }}>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-white/45">Carregando splits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
        <p className="text-sm text-red-300">{error}</p>
        <button
          onClick={() => { setLoaded(false); fetchAndRender(); }}
          className="mt-2 text-xs text-red-300 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!splits || splits.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] md:col-span-2" style={{ padding: "0.95rem" }}>
        <p className="text-sm text-white/45">Splits não disponíveis para esta atividade.</p>
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
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] md:col-span-2" style={{ padding: "0.95rem" }}>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Splits km a km
          </p>
          {activityName && (
            <p className="mt-1 text-[11px] text-white/[0.32]">{activityName}</p>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-1.5 text-[10px] text-white/[0.38] xl:w-auto xl:justify-end">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            Ritmo médio:{" "}
            <span className="font-semibold text-white/85">
              {formatPace(avgPace)}/km
            </span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            Melhor km:{" "}
            <span className="font-semibold text-emerald-400">
              {formatPace(bestPace)}/km
            </span>
          </span>
          {goalPaceSecPerKm && (
            <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-orange-200">
              <span className="inline-block h-2 w-4 border-b-2 border-dashed border-orange-400 align-middle" />{" "}
              Meta BsAs: {formatPace(goalPaceSecPerKm)}/km
            </span>
          )}
        </div>
      </div>

      <div className="relative h-64">
        <canvas
          ref={chartRef}
          role="img"
          aria-label={`Splits km a km de ${activityName ?? "atividade"}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-white/[0.30]">
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
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 border-b-2 border-dashed border-indigo-400 align-middle" />
          Média da corrida
        </span>
        {goalPaceSecPerKm && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 border-b-2 border-dashed border-orange-400 align-middle" />
            Meta BsAs
          </span>
        )}
      </div>
    </div>
  );
}

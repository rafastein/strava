"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

type LongRunPoint = {
  date: string;
  km: number;
  paceSeconds: number;
  efficiency: number | null;
  fc: number | null;
};

type RacePoint = {
  date: string;
  name: string;
  distanceKm: number;
  paceSeconds: number;
};

type Props = {
  longRuns: LongRunPoint[];
  weeksToRace: number;
  races?: RacePoint[];
};

const DIST_MARATHON = 42.195;

const GOALS = [
  { label: "Sub 3h",    totalSec: 3 * 3600 },
  { label: "Sub 3h30",  totalSec: 3 * 3600 + 30 * 60 },
  { label: "Sub 3h45",  totalSec: 3 * 3600 + 45 * 60 },
  { label: "Sub 4h",    totalSec: 4 * 3600 },
  { label: "Sub 4h30",  totalSec: 4 * 3600 + 30 * 60 },
];

function linReg(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

function secToStr(s: number) {
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function totalTimeStr(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return `${h}h ${m.toString().padStart(2, "0")}min ${sec.toString().padStart(2, "0")}s`;
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function MarathonProjection({ longRuns, weeksToRace, races = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<unknown>(null);

  const [weeks, setWeeks]               = useState(weeksToRace);
  const [pacingFactor, setPacingFactor] = useState(1.09);

  const t0    = longRuns.length ? new Date(longRuns[0].date).getTime() : Date.now();
  const days  = longRuns.map((l) => (new Date(l.date).getTime() - t0) / 86400000);
  const today = (Date.now() - t0) / 86400000;

  const paceReg = linReg(days, longRuns.map((l) => l.paceSeconds));
  const effData = longRuns.filter((l) => l.efficiency !== null);
  const effReg  = effData.length >= 2
    ? linReg(
        effData.map((l) => (new Date(l.date).getTime() - t0) / 86400000),
        effData.map((l) => l.efficiency as number)
      )
    : null;

  // Piso de pace: a regressão não pode projetar melhor que 4:55/km (295 s/km)
  // Evita extrapolações irreais em ciclos com tendência de melhora acentuada
  const PACE_FLOOR_SEC = 295;

  const futureDays  = today + weeks * 7;
  const projPaceRaw = paceReg.slope * futureDays + paceReg.intercept;
  const projPace    = Math.max(projPaceRaw, PACE_FLOOR_SEC);
  const projEff     = effReg ? effReg.slope * futureDays + effReg.intercept : null;
  const racePace    = projPace * pacingFactor;
  const totalSec    = racePace * DIST_MARATHON;

  const pacePerMonth = paceReg.slope * 30;
  const effPerMonth  = effReg ? effReg.slope * 30 : null;

  useEffect(() => {
    if (!canvasRef.current || longRuns.length === 0) return;

    if (chartRef.current) (chartRef.current as Chart).destroy();

    const isDark    = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "#c2c0b6" : "#5f5e5a";
    const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
    const labels    = longRuns.map((l) => formatDateLabel(l.date));

    // Map race dates to nearest longão index for categorical x-axis
    const raceDataOnAxis: (number | null)[] = longRuns.map(() => null);
    const raceLabelsOnAxis: (string | null)[] = longRuns.map(() => null);

    races.forEach((race) => {
      const raceTime = new Date(race.date).getTime();
      let nearest = 0;
      let minDiff = Infinity;
      longRuns.forEach((l, i) => {
        const diff = Math.abs(new Date(l.date).getTime() - raceTime);
        if (diff < minDiff) { minDiff = diff; nearest = i; }
      });
      // Only plot if within ~45 days of a longão
      if (minDiff < 45 * 86400000) {
        raceDataOnAxis[nearest] = race.paceSeconds;
        raceLabelsOnAxis[nearest] = race.name;
      }
    });

    const config: ChartConfiguration = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Pace (s/km)",
            data: longRuns.map((l) => l.paceSeconds),
            borderColor: "#f97316",
            backgroundColor: "rgba(249,115,22,0.08)",
            tension: 0.35,
            yAxisID: "yPace",
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          ...(effData.length >= 2
            ? [{
                label: "Eficiência",
                data: longRuns.map((l) => l.efficiency ?? null),
                borderColor: "#1D9E75",
                backgroundColor: "rgba(29,158,117,0.08)",
                tension: 0.35,
                yAxisID: "yEff",
                pointRadius: 4,
                pointHoverRadius: 6,
              }]
            : []),
          ...(races.length > 0
            ? [{
                label: "Provas",
                data: raceDataOnAxis,
                borderColor: "transparent",
                backgroundColor: "transparent",
                pointRadius: raceDataOnAxis.map((v) => v !== null ? 8 : 0),
                pointHoverRadius: raceDataOnAxis.map((v) => v !== null ? 10 : 0),
                pointBackgroundColor: "#8b5cf6",
                pointBorderColor: isDark ? "#1f2937" : "#fff",
                pointBorderWidth: 2,
                pointStyle: "rectRot",
                yAxisID: "yPace",
                tension: 0,
                spanGaps: false,
              }]
            : []),
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: textColor, font: { size: 12 }, boxWidth: 12, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "Provas") {
                  const s = ctx.raw as number | null;
                  if (!s) return "";
                  const name = raceLabelsOnAxis[ctx.dataIndex] ?? "Prova";
                  return ` ${name}: ${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}/km`;
                }
                if (ctx.dataset.yAxisID === "yPace") {
                  const s = ctx.raw as number;
                  return ` Pace: ${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}/km`;
                }
                return ` Eficiência: ${(ctx.raw as number).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
          yPace: {
            type: "linear", position: "left", reverse: true,
            ticks: {
              color: "#f97316", font: { size: 11 },
              callback: (v) => { const n = v as number, m = Math.floor(n / 60), s = n % 60; return `${m}:${s.toString().padStart(2, "0")}`; },
            },
            grid: { color: gridColor },
          },
          ...(effData.length >= 2
            ? { yEff: { type: "linear" as const, position: "right" as const, ticks: { color: "#1D9E75", font: { size: 11 } }, grid: { drawOnChartArea: false } } }
            : {}),
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartRef.current) { (chartRef.current as Chart).destroy(); chartRef.current = null; }
    };
  }, [longRuns, effData.length, races]);

  if (longRuns.length === 0) return null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-gray-900">
        Calculadora de projeção — maratona
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Regressão linear sobre os longões para estimar o tempo em Buenos Aires.
      </p>

      {/* Gráfico */}
      <div className="mt-5">
        <canvas ref={canvasRef} height={180} />
      </div>

      {/* Cards de tendência */}
      <div className="mt-5 grid grid-cols-5 gap-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Melhora de pace/mês</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {pacePerMonth < 0 ? "−" : "+"}{Math.abs(pacePerMonth).toFixed(1)}s/km
          </p>
          <p className="text-xs text-gray-400">{pacePerMonth < 0 ? "melhorando" : "piora no período"}</p>
        </div>

        {effPerMonth !== null && (
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Eficiência/mês</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {effPerMonth > 0 ? "+" : ""}{effPerMonth.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">{effPerMonth > 0 ? "crescendo" : "estabilizando"}</p>
          </div>
        )}

        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Maior longão</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {Math.max(...longRuns.map((l) => l.km)).toFixed(1)} km
          </p>
          <p className="text-xs text-gray-400">
            {formatDateLabel(longRuns.reduce((a, b) => (a.km >= b.km ? a : b)).date)}
          </p>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">FC média longões</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {longRuns.filter((l) => l.fc).length > 0
              ? Math.round(longRuns.filter((l) => l.fc).reduce((a, b) => a + (b.fc ?? 0), 0) / longRuns.filter((l) => l.fc).length) + " bpm"
              : "—"}
          </p>
          <p className="text-xs text-gray-400">média de {longRuns.length} longões</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-3">
          <label className="min-w-[130px] text-sm text-gray-500">Semanas até a prova</label>
          <input type="range" min={1} max={24} step={1} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="flex-1" />
          <span className="min-w-[52px] text-right text-sm font-medium text-gray-900">{weeks} sem</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="min-w-[130px] text-sm text-gray-500">Fator de pacing</label>
          <input type="range" min={1.05} max={1.15} step={0.01} value={pacingFactor} onChange={(e) => setPacingFactor(Number(e.target.value))} className="flex-1" />
          <span className="min-w-[52px] text-right text-sm font-medium text-gray-900">+{Math.round((pacingFactor - 1) * 100)}%</span>
        </div>
        <p className="ml-[130px] text-xs text-gray-400">
          +7–12% é o delta típico entre pace de longão de treino e pace real em maratona completa
        </p>
      </div>

      {/* Resultado */}
      <div className="mt-5 rounded-2xl border-2 border-orange-300 bg-orange-50 p-5">
        <p className="text-sm font-medium text-orange-700">Tempo projetado na maratona</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-orange-900">{totalTimeStr(totalSec)}</p>
        <p className="mt-2 text-sm text-orange-700">
          Pace no treino: {secToStr(projPace)}/km → em prova: {secToStr(racePace)}/km
          {projEff !== null && <span className="ml-2 opacity-70">· eficiência projetada: {projEff.toFixed(1)}</span>}
        </p>

        {/* Badges de metas */}
        <div className="mt-3 flex flex-wrap gap-2">
          {GOALS.map((g) => {
            const ok      = totalSec <= g.totalSec;
            const diffSec = Math.abs(totalSec - g.totalSec);
            const diffStr = secToStr(diffSec).replace(":", "min ") + "s";
            return (
              <span key={g.label} className={`rounded-full px-3 py-1 text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {ok ? `${g.label} ✓` : `${g.label} —`}
                <span className="ml-1 opacity-70">{ok ? `(+${diffStr})` : `(−${diffStr})`}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Metas de referência */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-medium text-gray-500">Pace necessário para cada meta</p>
        <div className="grid grid-cols-5 gap-2">
          {GOALS.map((g) => {
            const needPace = g.totalSec / DIST_MARATHON;
            const ok       = totalSec <= g.totalSec;
            const diffSec  = Math.abs(totalSec - g.totalSec);
            return (
              <div key={g.label} className={`rounded-2xl p-2 ${ok ? "bg-emerald-50" : "bg-gray-50"}`}>
                <p className="text-xs text-gray-500">{g.label}</p>
                <p className="mt-1 text-base font-bold text-gray-900">{secToStr(needPace)}/km</p>
                <p className={`mt-1 text-xs ${ok ? "text-emerald-600" : "text-red-500"}`}>
                  {ok
                    ? `${secToStr(diffSec).replace(":", "min ")}s de sobra`
                    : `faltam ~${secToStr(diffSec).replace(":", "min ")}s`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

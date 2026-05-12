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

    const isDark    = true;
    const textColor = "rgba(255,255,255,0.62)";
    const gridColor = "rgba(255,255,255,0.07)";
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
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          ...(effData.length >= 2
            ? [{
                label: "Eficiência",
                data: longRuns.map((l) => l.efficiency ?? null),
                borderColor: "#1D9E75",
                backgroundColor: "rgba(29,158,117,0.08)",
                tension: 0.35,
                yAxisID: "yEff",
                pointRadius: 3,
                pointHoverRadius: 5,
              }]
            : []),
          ...(races.length > 0
            ? [{
                label: "Provas",
                data: raceDataOnAxis,
                borderColor: "transparent",
                backgroundColor: "transparent",
                pointRadius: raceDataOnAxis.map((v) => v !== null ? 6 : 0),
                pointHoverRadius: raceDataOnAxis.map((v) => v !== null ? 8 : 0),
                pointBackgroundColor: "#8b5cf6",
                pointBorderColor: "#151515",
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
          legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 10 } },
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
          x: { ticks: { color: textColor, font: { size: 9 } }, grid: { color: gridColor } },
          yPace: {
            type: "linear", position: "left", reverse: true,
            ticks: {
              color: "#f97316", font: { size: 9 },
              callback: (v) => { const n = v as number, m = Math.floor(n / 60), s = n % 60; return `${m}:${s.toString().padStart(2, "0")}`; },
            },
            grid: { color: gridColor },
          },
          ...(effData.length >= 2
            ? { yEff: { type: "linear" as const, position: "right" as const, ticks: { color: "#1D9E75", font: { size: 9 } }, grid: { drawOnChartArea: false } } }
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
    <div className="rounded-[22px] border border-white/10 bg-[#151515] p-5 shadow-[0_18px_60px_rgba(0,0,0,.20)]">
      <h3 className="text-[15px] font-semibold text-white">
        Calculadora de projeção — maratona
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-white/42">
        Regressão linear sobre os longões para estimar o tempo em Buenos Aires.
      </p>

      {/* Gráfico */}
      <div className="mt-3 rounded-2xl border border-white/5 bg-black/10 p-2">
        <canvas ref={canvasRef} height={118} />
      </div>

      {/* Cards de tendência */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.032] p-2.5 text-center">
          <p className="text-[10px] text-white/40">Melhora de pace/mês</p>
          <p className="mt-1 text-[12px] font-semibold text-white">
            {pacePerMonth < 0 ? "−" : "+"}{Math.abs(pacePerMonth).toFixed(1)}s/km
          </p>
          <p className="text-[10px] text-white/34">{pacePerMonth < 0 ? "melhorando" : "piora no período"}</p>
        </div>

        {effPerMonth !== null && (
          <div className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.032] p-2.5 text-center">
            <p className="text-[10px] text-white/40">Eficiência/mês</p>
            <p className="mt-1 text-[12px] font-semibold text-white">
              {effPerMonth > 0 ? "+" : ""}{effPerMonth.toFixed(2)}
            </p>
            <p className="text-[10px] text-white/34">{effPerMonth > 0 ? "crescendo" : "estabilizando"}</p>
          </div>
        )}

        <div className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.032] p-2.5 text-center">
          <p className="text-[10px] text-white/40">Maior longão</p>
          <p className="mt-1 text-[12px] font-semibold text-white">
            {Math.max(...longRuns.map((l) => l.km)).toFixed(1)} km
          </p>
          <p className="text-[10px] text-white/34">
            {formatDateLabel(longRuns.reduce((a, b) => (a.km >= b.km ? a : b)).date)}
          </p>
        </div>

        <div className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.032] p-2.5 text-center">
          <p className="text-[10px] text-white/40">FC média longões</p>
          <p className="mt-1 text-[12px] font-semibold text-white">
            {longRuns.filter((l) => l.fc).length > 0
              ? Math.round(longRuns.filter((l) => l.fc).reduce((a, b) => a + (b.fc ?? 0), 0) / longRuns.filter((l) => l.fc).length) + " bpm"
              : "—"}
          </p>
          <p className="text-[10px] text-white/34">média de {longRuns.length} longões</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-5 rounded-2xl border border-white/5 bg-white/[.025] p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <label className="min-w-[118px] text-[10.5px] text-white/45">Semanas até a prova</label>
          <input type="range" min={1} max={24} step={1} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="flex-1" />
          <span className="min-w-[48px] text-right text-[10.5px] font-medium text-white/80">{weeks} sem</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="min-w-[118px] text-[10.5px] text-white/45">Fator de pacing</label>
          <input type="range" min={1.05} max={1.15} step={0.01} value={pacingFactor} onChange={(e) => setPacingFactor(Number(e.target.value))} className="flex-1" />
          <span className="min-w-[48px] text-right text-[10.5px] font-medium text-white/80">+{Math.round((pacingFactor - 1) * 100)}%</span>
        </div>
        <p className="ml-[128px] text-[9.5px] text-white/32">
          +7–12% é o delta típico entre pace de longão de treino e pace real em maratona completa
        </p>
      </div>

      {/* Resultado */}
      <div className="mt-5 rounded-2xl border border-orange-400/22 bg-orange-500/[.075] p-4 text-center">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-orange-300/85">Tempo projetado na maratona</p>
        <p className="mt-1.5 text-[18px] font-semibold tracking-tight text-orange-100">{totalTimeStr(totalSec)}</p>
        <p className="mt-1.5 text-[10.5px] text-orange-300/72">
          Pace no treino: {secToStr(projPace)}/km → em prova: {secToStr(racePace)}/km
          {projEff !== null && <span className="ml-2 opacity-70">· eficiência projetada: {projEff.toFixed(1)}</span>}
        </p>
      </div>

      {/* Metas de referência */}
      <div className="mt-5">
        <p className="mb-2.5 text-center text-[10.5px] font-medium text-white/42">Pace necessário para cada meta</p>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
          {GOALS.map((g) => {
            const needPace = g.totalSec / DIST_MARATHON;
            const ok       = totalSec <= g.totalSec;
            const diffSec  = Math.abs(totalSec - g.totalSec);
            return (
              <div key={g.label} className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl p-2.5 text-center ${ok ? "border border-emerald-400/20 bg-emerald-400/10" : "border border-white/10 bg-white/[.035]"}`}>
                <p className="text-[10.5px] text-white/42">{g.label}</p>
                <p className="mt-1 text-[12px] font-semibold text-white">{secToStr(needPace)}/km</p>
                <p className={`mt-1 text-[9.5px] leading-tight ${ok ? "text-emerald-300" : "text-red-300"}`}>
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

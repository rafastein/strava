"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Legend,
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
  races?: RacePoint[];
};

const DIST_MARATHON = 42.195;

const GOALS = [
  { label: "Sub 3h", totalSec: 3 * 3600 },
  { label: "Sub 3h30", totalSec: 3 * 3600 + 30 * 60 },
  { label: "Sub 3h45", totalSec: 3 * 3600 + 45 * 60 },
  { label: "Sub 4h", totalSec: 4 * 3600 },
  { label: "Sub 4h30", totalSec: 4 * 3600 + 30 * 60 },
];

function linReg(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }

  const slope = den ? num / den : 0;

  return {
    slope,
    intercept: my - slope * mx,
  };
}

function secToStr(seconds: number) {
  if (!Number.isFinite(seconds)) return "--:--";

  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const sec = Math.round(absSeconds % 60);

  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function signedSecToStr(seconds: number) {
  if (!Number.isFinite(seconds)) return "--:--";

  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "";
  return `${sign}${secToStr(seconds)}`;
}

function totalTimeStr(seconds: number) {
  if (!Number.isFinite(seconds)) return "--";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.round(seconds % 60);

  return `${h}h ${m.toString().padStart(2, "0")}min ${sec
    .toString()
    .padStart(2, "0")}s`;
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatDeltaLabel(seconds: number, ok: boolean) {
  const normalized = secToStr(seconds).replace(":", "min ");
  return ok ? `${normalized}s de sobra` : `faltam ~${normalized}s`;
}

const RACE_DATE = new Date("2026-09-20T06:00:00-03:00");

export default function MarathonProjection({
  longRuns,
  races = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const weeks = Math.max(1, Math.ceil((RACE_DATE.getTime() - Date.now()) / (7 * 86400000)));
  const [nLongRuns, setNLongRuns] = useState(5);
  const [pacingFactor, setPacingFactor] = useState(0.92);

  const data = useMemo(() => {
    if (longRuns.length === 0) return null;

    const t0 = new Date(longRuns[0].date).getTime();
    const days = longRuns.map(
      (longRun) => (new Date(longRun.date).getTime() - t0) / 86400000,
    );
    const today = (Date.now() - t0) / 86400000;

    const paceReg = linReg(
      days,
      longRuns.map((longRun) => longRun.paceSeconds),
    );

    const effData = longRuns.filter((longRun) => longRun.efficiency !== null);
    const effReg =
      effData.length >= 2
        ? linReg(
            effData.map(
              (longRun) => (new Date(longRun.date).getTime() - t0) / 86400000,
            ),
            effData.map((longRun) => longRun.efficiency as number),
          )
        : null;

    const PACE_FLOOR_SEC = 295;
    const futureDays = today + weeks * 7;
    const projPaceRaw = paceReg.slope * futureDays + paceReg.intercept;
    const projPaceRegression = Math.max(projPaceRaw, PACE_FLOOR_SEC);
    const projEff = effReg ? effReg.slope * futureDays + effReg.intercept : null;

    // Pace médio dos últimos N longões
    const lastN = longRuns.slice(-nLongRuns);
    const avgPaceLastN = lastN.reduce((acc, r) => acc + r.paceSeconds, 0) / lastN.length;
    const projPace = Math.max(avgPaceLastN, PACE_FLOOR_SEC);

    // Pace de prova = pace treino * fator (< 1 = mais rápido em prova)
    const racePace = projPace * pacingFactor;
    const totalSec = racePace * DIST_MARATHON;
    const pacePerMonth = paceReg.slope * 30;
    const effPerMonth = effReg ? effReg.slope * 30 : null;
    const biggestLongRun = longRuns.reduce((a, b) => (a.km >= b.km ? a : b));
    const runsWithFc = longRuns.filter((longRun) => longRun.fc);
    const avgFc =
      runsWithFc.length > 0
        ? Math.round(
            runsWithFc.reduce((a, b) => a + (b.fc ?? 0), 0) /
              runsWithFc.length,
          )
        : null;

    return {
      t0,
      effData,
      projPace,
      projEff,
      racePace,
      totalSec,
      pacePerMonth,
      effPerMonth,
      biggestLongRun,
      avgFc,
    };
  }, [longRuns, weeks, pacingFactor, nLongRuns]);

  useEffect(() => {
    if (!canvasRef.current || longRuns.length === 0 || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    const labels = longRuns.map((longRun) => formatDateLabel(longRun.date));
    const raceDataOnAxis: Array<number | null> = longRuns.map(() => null);
    const raceLabelsOnAxis: Array<string | null> = longRuns.map(() => null);

    races.forEach((race) => {
      const raceTime = new Date(race.date).getTime();
      let nearest = 0;
      let minDiff = Infinity;

      longRuns.forEach((longRun, index) => {
        const diff = Math.abs(new Date(longRun.date).getTime() - raceTime);

        if (diff < minDiff) {
          minDiff = diff;
          nearest = index;
        }
      });

      if (minDiff < 45 * 86400000) {
        raceDataOnAxis[nearest] = race.paceSeconds;
        raceLabelsOnAxis[nearest] = race.name;
      }
    });

    const datasets: any[] = [
      {
        label: "Pace",
        data: longRuns.map((longRun) => longRun.paceSeconds),
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.08)",
        tension: 0.35,
        yAxisID: "yPace",
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ];

    if (data.effData.length >= 2) {
      datasets.push({
        label: "Eficiência",
        data: longRuns.map((longRun) => longRun.efficiency ?? null),
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.08)",
        tension: 0.35,
        yAxisID: "yEff",
        pointRadius: 3,
        pointHoverRadius: 5,
      });
    }

    if (races.length > 0) {
      datasets.push({
        label: "Provas",
        data: raceDataOnAxis,
        borderColor: "transparent",
        backgroundColor: "transparent",
        pointRadius: raceDataOnAxis.map((value) => (value !== null ? 6 : 0)),
        pointHoverRadius: raceDataOnAxis.map((value) =>
          value !== null ? 8 : 0,
        ),
        pointBackgroundColor: "#8b5cf6",
        pointBorderColor: "#111214",
        pointBorderWidth: 2,
        pointStyle: "rectRot",
        yAxisID: "yPace",
        tension: 0,
        spanGaps: false,
      });
    }

    const config: ChartConfiguration = {
      type: "line",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: "rgba(255,255,255,0.58)",
              font: { size: 10 },
              boxWidth: 10,
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: "#111214",
            titleColor: "#fff",
            bodyColor: "rgba(255,255,255,0.75)",
            borderColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === "Provas") {
                  const seconds = ctx.raw as number | null;
                  if (!seconds) return "";
                  const name = raceLabelsOnAxis[ctx.dataIndex] ?? "Prova";
                  return ` ${name}: ${secToStr(seconds)}/km`;
                }

                if ((ctx.dataset as any).yAxisID === "yPace") {
                  const seconds = ctx.raw as number;
                  return ` Pace: ${secToStr(seconds)}/km`;
                }

                return ` Eficiência: ${(ctx.raw as number).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "rgba(255,255,255,0.45)",
              font: { size: 10 },
            },
            grid: {
              color: "rgba(255,255,255,0.05)",
            },
          },
          yPace: {
            type: "linear",
            position: "left",
            reverse: true,
            ticks: {
              color: "#f97316",
              font: { size: 10 },
              callback: (value) => secToStr(Number(value)),
            },
            grid: {
              color: "rgba(255,255,255,0.055)",
            },
          },
          ...(data.effData.length >= 2
            ? {
                yEff: {
                  type: "linear" as const,
                  position: "right" as const,
                  ticks: {
                    color: "#10b981",
                    font: { size: 10 },
                  },
                  grid: {
                    drawOnChartArea: false,
                  },
                },
              }
            : {}),
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [longRuns, races, data]);

  if (longRuns.length === 0 || !data) return null;

  return (
    <section
      className="ba-card marathon-projection-card"
      style={{ padding: "1.2rem", marginBottom: "1rem" }}
    >
      <div className="ba-card-head">
        <div>
          <p className="ba-label">Calculadora de projeção</p>
          <h2
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: 750,
              marginTop: 8,
            }}
          >
            Projeção para Buenos Aires
          </h2>
          <p className="ba-muted" style={{ marginTop: 6, maxWidth: 620 }}>
            Regressão linear sobre os longões para estimar o tempo em Buenos
            Aires.
          </p>
        </div>
      </div>

      <div className="ba-grid-4" style={{ marginTop: "1rem" }}>
        <MetricCard
          label="Maior longão"
          value={`${data.biggestLongRun.km.toFixed(1)} km`}
          helper={formatDateLabel(data.biggestLongRun.date)}
        />
        <MetricCard
          label="FC média"
          value={data.avgFc ? `${data.avgFc} bpm` : "--"}
          helper="longões com FC"
        />
        <MetricCard
          label="Tendência de pace"
          value={`${signedSecToStr(data.pacePerMonth)}/km`}
          helper={data.pacePerMonth <= 0 ? "melhorando/mês" : "mais lento/mês"}
        />
        {data.effPerMonth !== null ? (
          <MetricCard
            label="Eficiência/mês"
            value={`${data.effPerMonth > 0 ? "+" : ""}${data.effPerMonth.toFixed(
              2,
            )}`}
            helper={data.effPerMonth > 0 ? "crescendo" : "estabilizando"}
          />
        ) : (
          <MetricCard label="Eficiência/mês" value="--" helper="sem série" />
        )}
      </div>

      <div className="marathon-projection-chart-wrap">
        <canvas ref={canvasRef} />
      </div>

      <div className="marathon-projection-controls">
        <p style={{ margin: "0 0 0.5rem", color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
          <strong style={{ color: "rgba(255,255,255,0.7)" }}>{weeks} semanas</strong> até Buenos Aires
        </p>
        <SliderRow
          label="Longões para média"
          valueLabel={`últimos ${nLongRuns}`}
          min={1}
          max={Math.min(10, longRuns.length)}
          step={1}
          value={nLongRuns}
          onChange={setNLongRuns}
        />
        <SliderRow
          label="Fator treino → prova"
          valueLabel={`${Math.round(pacingFactor * 100)}%`}
          min={0.88}
          max={0.97}
          step={0.01}
          value={pacingFactor}
          onChange={setPacingFactor}
        />
        <p
          style={{
            margin: 0,
            color: "rgba(255,255,255,0.42)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          92–95% é o fator típico: em prova você corre 5–8% mais rápido que o pace médio dos longões.
        </p>
      </div>

      <div
        style={{
          borderRadius: 26,
          padding: "1.3rem 1.1rem",
          textAlign: "center",
          background:
            "linear-gradient(180deg, rgba(120,53,15,0.38) 0%, rgba(67,27,8,0.44) 100%)",
          border: "1px solid rgba(249,115,22,0.28)",
          marginBottom: 28,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#f59e0b",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Tempo projetado na maratona
        </p>
        <h3
          style={{
            color: "#fff",
            fontSize: 30,
            lineHeight: 1,
            fontWeight: 850,
            marginTop: 9,
            marginBottom: 8,
          }}
        >
          {totalTimeStr(data.totalSec)}
        </h3>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          Pace no treino: {secToStr(data.projPace)}/km → em prova:{" "}
          {secToStr(data.racePace)}/km
          {data.projEff !== null && (
            <span> · eficiência projetada: {data.projEff.toFixed(1)}</span>
          )}
        </p>
      </div>

      <div
        style={{
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            color: "rgba(255,255,255,0.42)",
            fontSize: 10,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Pace necessário para cada meta
        </p>
      </div>

      <div className="marathon-goals-grid">
        {GOALS.map((goal) => {
          const needPace = goal.totalSec / DIST_MARATHON;
          const ok = data.totalSec <= goal.totalSec;
          const diffSec = Math.abs(data.totalSec - goal.totalSec);

          return (
            <div
              key={goal.label}
              className="marathon-goal-card"
              style={{
                background: ok
                  ? "rgba(16,185,129,0.13)"
                  : "rgba(255,255,255,0.035)",
                border: ok
                  ? "1px solid rgba(16,185,129,0.33)"
                  : "1px solid rgba(255,255,255,0.075)",
              }}
            >
              <p className="marathon-goal-card__label">{goal.label}</p>

              <strong className="marathon-goal-card__pace">
                {secToStr(needPace)}/km
              </strong>

              <span
                className="marathon-goal-card__delta"
                style={{ color: ok ? "#34d399" : "#f87171" }}
              >
                {formatDeltaLabel(diffSec, ok)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="marathon-projection-metric-card">
      <p
        style={{
          margin: 0,
          color: "rgba(255,255,255,0.45)",
          fontSize: 11,
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>
      <strong
        style={{
          marginTop: 6,
          color: "#fff",
          fontSize: 16,
          lineHeight: 1.1,
        }}
      >
        {value}
      </strong>
      <span
        style={{
          marginTop: 5,
          color: "rgba(255,255,255,0.35)",
          fontSize: 11,
          lineHeight: 1.2,
        }}
      >
        {helper}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="marathon-projection-slider-row">
      <span className="marathon-projection-slider-row__head">
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%", accentColor: "#0ea5e9" }}
      />
    </label>
  );
}

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

  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }

  const slope = den ? num / den : 0;

  return {
    slope,
    intercept: my - slope * mx,
  };
}

function secToStr(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function totalTimeStr(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);

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

export default function MarathonProjection({
  longRuns,
  weeksToRace,
  races = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const [weeks, setWeeks] = useState(weeksToRace);
  const [pacingFactor, setPacingFactor] = useState(1.09);

  const data = useMemo(() => {
    if (longRuns.length === 0) return null;

    const t0 = new Date(longRuns[0].date).getTime();
    const days = longRuns.map(
      (l) => (new Date(l.date).getTime() - t0) / 86400000
    );

    const today = (Date.now() - t0) / 86400000;
    const paceReg = linReg(
      days,
      longRuns.map((l) => l.paceSeconds)
    );

    const effData = longRuns.filter((l) => l.efficiency !== null);

    const effReg =
      effData.length >= 2
        ? linReg(
            effData.map(
              (l) => (new Date(l.date).getTime() - t0) / 86400000
            ),
            effData.map((l) => l.efficiency as number)
          )
        : null;

    const PACE_FLOOR_SEC = 295;
    const futureDays = today + weeks * 7;
    const projPaceRaw = paceReg.slope * futureDays + paceReg.intercept;
    const projPace = Math.max(projPaceRaw, PACE_FLOOR_SEC);
    const projEff = effReg ? effReg.slope * futureDays + effReg.intercept : null;
    const racePace = projPace * pacingFactor;
    const totalSec = racePace * DIST_MARATHON;

    const pacePerMonth = paceReg.slope * 30;
    const effPerMonth = effReg ? effReg.slope * 30 : null;

    const biggestLongRun = longRuns.reduce((a, b) => (a.km >= b.km ? a : b));

    const runsWithFc = longRuns.filter((l) => l.fc);
    const avgFc =
      runsWithFc.length > 0
        ? Math.round(
            runsWithFc.reduce((a, b) => a + (b.fc ?? 0), 0) /
              runsWithFc.length
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
  }, [longRuns, weeks, pacingFactor]);

  useEffect(() => {
    if (!canvasRef.current || longRuns.length === 0 || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    const labels = longRuns.map((l) => formatDateLabel(l.date));

    const raceDataOnAxis: (number | null)[] = longRuns.map(() => null);
    const raceLabelsOnAxis: (string | null)[] = longRuns.map(() => null);

    races.forEach((race) => {
      const raceTime = new Date(race.date).getTime();
      let nearest = 0;
      let minDiff = Infinity;

      longRuns.forEach((l, i) => {
        const diff = Math.abs(new Date(l.date).getTime() - raceTime);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = i;
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
        data: longRuns.map((l) => l.paceSeconds),
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
        data: longRuns.map((l) => l.efficiency ?? null),
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
        pointRadius: raceDataOnAxis.map((v) => (v !== null ? 6 : 0)),
        pointHoverRadius: raceDataOnAxis.map((v) => (v !== null ? 8 : 0)),
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
                  const s = ctx.raw as number | null;
                  if (!s) return "";

                  const name = raceLabelsOnAxis[ctx.dataIndex] ?? "Prova";
                  return ` ${name}: ${secToStr(s)}/km`;
                }

                if ((ctx.dataset as any).yAxisID === "yPace") {
                  const s = ctx.raw as number;
                  return ` Pace: ${secToStr(s)}/km`;
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
              callback: (v) => secToStr(Number(v)),
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
      style={{
        background:
          "linear-gradient(180deg, rgba(20,20,22,0.96) 0%, rgba(12,12,14,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 24,
        marginTop: 28,
        overflow: "hidden",
        boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
      }}
    >
      <div style={{ marginBottom: 22 }}>
        <p
          style={{
            color: "#f59e0b",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Calculadora de projeção
        </p>

        <h2
          style={{
            color: "#fff",
            fontSize: 22,
            lineHeight: 1.1,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Projeção para Buenos Aires
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 13,
            lineHeight: 1.5,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Regressão linear sobre os longões para estimar o tempo em Buenos
          Aires.
        </p>
      </div>

      <div
        style={{
          height: 360,
          borderRadius: 20,
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: 14,
          marginBottom: 28,
        }}
      >
        <canvas ref={canvasRef} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <MetricCard
          label="Melhora de pace/mês"
          value={`${data.pacePerMonth < 0 ? "−" : "+"}${Math.abs(
            data.pacePerMonth
          ).toFixed(1)}s/km`}
          helper={data.pacePerMonth < 0 ? "melhorando" : "piora no período"}
        />

        {data.effPerMonth !== null && (
          <MetricCard
            label="Eficiência/mês"
            value={`${data.effPerMonth > 0 ? "+" : ""}${data.effPerMonth.toFixed(
              2
            )}`}
            helper={data.effPerMonth > 0 ? "crescendo" : "estabilizando"}
          />
        )}

        <MetricCard
          label="Maior longão"
          value={`${data.biggestLongRun.km.toFixed(1)} km`}
          helper={formatDateLabel(data.biggestLongRun.date)}
        />

        <MetricCard
          label="FC média longões"
          value={data.avgFc ? `${data.avgFc} bpm` : "—"}
          helper={`média de ${longRuns.length} longões`}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <SliderRow
          label="Semanas até a prova"
          valueLabel={`${weeks} sem`}
          min={1}
          max={24}
          step={1}
          value={weeks}
          onChange={setWeeks}
        />

        <SliderRow
          label="Fator de pacing"
          valueLabel={`+${Math.round((pacingFactor - 1) * 100)}%`}
          min={1.05}
          max={1.15}
          step={0.01}
          value={pacingFactor}
          onChange={setPacingFactor}
        />

        <p
          style={{
            margin: 0,
            color: "rgba(255,255,255,0.36)",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          +7–12% é o delta típico entre pace de longão de treino e pace real em
          maratona completa.
        </p>
      </div>

      <div
        style={{
          borderRadius: 22,
          padding: 22,
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {GOALS.map((g) => {
          const needPace = g.totalSec / DIST_MARATHON;
          const ok = data.totalSec <= g.totalSec;
          const diffSec = Math.abs(data.totalSec - g.totalSec);

          return (
            <div
              key={g.label}
              style={{
                minHeight: 92,
                borderRadius: 18,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                background: ok
                  ? "rgba(16,185,129,0.13)"
                  : "rgba(255,255,255,0.035)",
                border: ok
                  ? "1px solid rgba(16,185,129,0.33)"
                  : "1px solid rgba(255,255,255,0.075)",
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  margin: 0,
                }}
              >
                {g.label}
              </p>

              <strong
                style={{
                  color: "#fff",
                  fontSize: 18,
                  lineHeight: 1.1,
                  marginTop: 7,
                }}
              >
                {secToStr(needPace)}/km
              </strong>

              <span
                style={{
                  color: ok ? "#34d399" : "#f87171",
                  fontSize: 11,
                  marginTop: 7,
                }}
              >
                {ok
                  ? `${secToStr(diffSec).replace(":", "min ")}s de sobra`
                  : `faltam ~${secToStr(diffSec).replace(":", "min ")}s`}
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
    <div
      style={{
        minHeight: 86,
        borderRadius: 18,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.075)",
      }}
    >
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
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.56)",
            fontSize: 12,
          }}
        >
          {label}
        </span>

        <strong
          style={{
            color: "#fff",
            fontSize: 12,
          }}
        >
          {valueLabel}
        </strong>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: "#0ea5e9",
        }}
      />
    </div>
  );
}
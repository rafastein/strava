"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Props = {
  projectionData: any[];
  projectedMarathonTime: string;
  pacingDeltaPercent: number;
  weeksToRace: number;
};

export default function MarathonProjection({
  projectionData,
  projectedMarathonTime,
  pacingDeltaPercent,
  weeksToRace,
}: Props) {
  return (
    <section
      style={{
        background:
          "linear-gradient(180deg, rgba(18,18,20,0.96) 0%, rgba(12,12,14,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 28,
        marginTop: 28,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div className="space-y-6">
        <div>
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#f59e0b",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Calculadora de projeção
          </p>

          <h2
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.1,
            }}
          >
            Projeção para Buenos Aires
          </h2>

          <p
            style={{
              marginTop: 10,
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              maxWidth: 700,
              lineHeight: 1.6,
            }}
          >
            Estimativa baseada na evolução dos longões, eficiência e volume
            recente.
          </p>
        </div>

        <div
          style={{
            height: 360,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.05)",
            padding: 16,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projectionData}>
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              />

              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              />

              <Tooltip
                contentStyle={{
                  background: "#111214",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  color: "#fff",
                }}
              />

              <Line
                type="monotone"
                dataKey="pace"
                stroke="#f97316"
                strokeWidth={3}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="grid grid-cols-4 gap-4"
          style={{
            marginTop: 8,
          }}
        >
          <div className="projection-mini-card">
            <span>Melhora de pace/mês</span>
            <strong>-5.7s/km</strong>
            <small>melhorando</small>
          </div>

          <div className="projection-mini-card">
            <span>Eficiência/mês</span>
            <strong>+2.44</strong>
            <small>crescendo</small>
          </div>

          <div className="projection-mini-card">
            <span>Maior longão</span>
            <strong>21.4 km</strong>
            <small>12 de abr.</small>
          </div>

          <div className="projection-mini-card">
            <span>FC média longões</span>
            <strong>159 bpm</strong>
            <small>média de 6 longões</small>
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: 13,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              <span>Semanas até a prova</span>
              <span>{weeksToRace} sem</span>
            </div>

            <div className="projection-slider-track">
              <div
                className="projection-slider-fill"
                style={{ width: "72%" }}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: 13,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              <span>Fator de pacing</span>
              <span>{pacingDeltaPercent > 0 ? "+" : ""}{pacingDeltaPercent}%</span>
            </div>

            <div className="projection-slider-track">
              <div
                className="projection-slider-fill"
                style={{ width: "41%" }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            background:
              "linear-gradient(180deg, rgba(120,53,15,0.35) 0%, rgba(70,28,8,0.45) 100%)",
            border: "1px solid rgba(249,115,22,0.25)",
            borderRadius: 22,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#f59e0b",
              marginBottom: 10,
              fontWeight: 700,
            }}
          >
            Tempo projetado na maratona
          </p>

          <h3
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {projectedMarathonTime}
          </h3>

          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            Pace estimado baseado em evolução recente dos longões.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-4 mt-6">
          {[
            {
              title: "Sub 3h",
              pace: "4:16/km",
              extra: "faltam ~46min",
              positive: false,
            },
            {
              title: "Sub 3h30",
              pace: "4:59/km",
              extra: "faltam ~16min",
              positive: false,
            },
            {
              title: "Sub 3h45",
              pace: "5:20/km",
              extra: "quase no alvo",
              positive: false,
            },
            {
              title: "Sub 4h",
              pace: "5:41/km",
              extra: "13min de sobra",
              positive: true,
            },
            {
              title: "Sub 4h30",
              pace: "6:24/km",
              extra: "43min de sobra",
              positive: true,
            },
          ].map((goal) => (
            <div
              key={goal.title}
              style={{
                borderRadius: 20,
                padding: 20,
                textAlign: "center",
                background: goal.positive
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(255,255,255,0.03)",
                border: goal.positive
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 10,
                }}
              >
                {goal.title}
              </p>

              <h4
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {goal.pace}
              </h4>

              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: goal.positive ? "#34d399" : "#f87171",
                }}
              >
                {goal.extra}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
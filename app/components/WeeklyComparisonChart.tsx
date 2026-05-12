"use client";

type WeeklyItem = {
  label?: string;
  weekLabel?: string;
  week?: string;
  range?: string;
  plannedKm?: number;
  planned?: number;
  totalPlannedKm?: number;
  executedKm?: number;
  doneKm?: number;
  actualKm?: number;
  stravaKm?: number;
  adherencePct?: number | null;
  adherence?: number | null;
  isCurrent?: boolean;
  current?: boolean;
};

type Props = {
  items: WeeklyItem[];
  title?: string;
  subtitle?: string;
  dark?: boolean;
};

function getNumber(...values: Array<number | undefined | null>) {
  const value = values.find((v) => typeof v === "number" && !Number.isNaN(v));
  return value ?? 0;
}

function getLabel(item: WeeklyItem) {
  return item.label ?? item.weekLabel ?? item.week ?? item.range ?? "Semana";
}

export default function WeeklyComparisonChart({
  items,
  title = "Planejado x executado por semana",
  subtitle = "Volume planejado no SisRUN comparado com o executado no Strava.",
}: Props) {
  return (
    <section
      style={{
        background:
          "linear-gradient(180deg, rgba(22,22,24,0.96) 0%, rgba(14,14,16,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 28,
        boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h2
          style={{
            color: "#fff",
            fontSize: 20,
            lineHeight: 1.15,
            fontWeight: 800,
            margin: 0,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.48)",
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          {subtitle}
        </p>

        <p
          style={{
            color: "rgba(255,255,255,0.28)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          Da semana mais recente para a mais antiga
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {items.map((item, index) => {
          const plannedKm = getNumber(
            item.plannedKm,
            item.planned,
            item.totalPlannedKm
          );

          const executedKm = getNumber(
            item.executedKm,
            item.doneKm,
            item.actualKm,
            item.stravaKm
          );

          const adherencePct =
            item.adherencePct ??
            item.adherence ??
            (plannedKm > 0 ? (executedKm / plannedKm) * 100 : 0);

          const progressPct =
            plannedKm > 0 ? Math.min((executedKm / plannedKm) * 100, 100) : 0;

          const isCurrent = Boolean(item.isCurrent ?? item.current);
          const isDone = adherencePct >= 100;
          const isPartial = adherencePct >= 70 && adherencePct < 100;

          const barColor = isDone
            ? "#22c55e"
            : isPartial
            ? "#f97316"
            : "#ef4444";

          return (
            <article
              key={`${getLabel(item)}-${index}`}
              style={{
                borderRadius: 22,
                padding: 22,
                background: isCurrent
                  ? "linear-gradient(180deg, rgba(245,166,35,0.14) 0%, rgba(245,166,35,0.055) 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.025) 100%)",
                border: isCurrent
                  ? "1px solid rgba(245,166,35,0.34)"
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isCurrent
                  ? "0 12px 34px rgba(245,166,35,0.08)"
                  : "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 18,
                  alignItems: "flex-start",
                  marginBottom: 22,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <h3
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        lineHeight: 1.1,
                        fontWeight: 800,
                        margin: 0,
                      }}
                    >
                      {getLabel(item)}
                    </h3>

                    {isCurrent && (
                      <span
                        style={{
                          color: "#f5a623",
                          background: "rgba(245,166,35,0.14)",
                          border: "1px solid rgba(245,166,35,0.28)",
                          borderRadius: 999,
                          padding: "3px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      >
                        Atual
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      color: "rgba(255,255,255,0.48)",
                      fontSize: 12,
                      margin: 0,
                    }}
                  >
                    Progresso real
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong
                    style={{
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: 1.2,
                      display: "block",
                    }}
                  >
                    {executedKm.toFixed(1)} / {plannedKm.toFixed(1)} km
                  </strong>

                  <span
                    style={{
                      color: "rgba(255,255,255,0.42)",
                      fontSize: 11,
                      display: "block",
                      marginTop: 6,
                    }}
                  >
                    {Math.round(adherencePct)}% de aderência
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    height: 7,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.09)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: barColor,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <MiniMetric label="Planejado" value={`${plannedKm.toFixed(1)} km`} />
                <MiniMetric label="Executado" value={`${executedKm.toFixed(1)} km`} />
                <MiniMetric label="Aderência" value={`${Math.round(adherencePct)}%`} />
              </div>

              <p
                style={{
                  color: "rgba(255,255,255,0.52)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {isDone
                  ? `Meta semanal cumprida. Excedente de ${(
                      executedKm - plannedKm
                    ).toFixed(1)} km.`
                  : `Faltam ${Math.max(plannedKm - executedKm, 0).toFixed(
                      1
                    )} km para cumprir o planejado da semana.`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.34)",
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: 0,
          marginBottom: 8,
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "#fff",
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
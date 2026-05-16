type TrainingPaceItem = {
  label: string;
  value: string;
};

type PerformanceSectionProps = {
  vdot: number;
  vo2max: number | null;
  marathonPaceLabel: string;
  trainingPaces: TrainingPaceItem[];
};

export default function PerformanceSection({
  vdot,
  vo2max,
  marathonPaceLabel,
  trainingPaces,
}: PerformanceSectionProps) {
  return (
    <section className="ba-two" style={{ marginBottom: "1rem" }}>
      <div className="ba-card" style={{ padding: "1.2rem" }}>
        <div className="ba-card-head">
          <div>
            <p className="ba-label">Performance</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                marginTop: 10,
              }}
            >
              VO2max estimado
            </h2>
            <p className="ba-muted" style={{ marginTop: 4 }}>
              Calculado automaticamente pelos PRs do Strava.
            </p>
          </div>
          <span
            style={{
              color: "#93c5fd",
              background: "rgba(59,130,246,.12)",
              border: "1px solid rgba(59,130,246,.25)",
              padding: ".35rem .65rem",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            VDOT {vdot.toFixed(1)}
          </span>
        </div>
        <div className="ba-grid-2" style={{ marginTop: "1.25rem" }}>
          <div
            className="ba-card-soft"
            style={{
              padding: "1rem",
              background: "rgba(59,130,246,.1)",
              borderColor: "rgba(59,130,246,.2)",
            }}
          >
            <p className="ba-label">VO2max</p>
            <p className="ba-value" style={{ fontSize: 42, color: "#60a5fa", marginTop: 8 }}>
              {vo2max?.toFixed(1) ?? vdot.toFixed(1)}
            </p>
            <p className="ba-muted" style={{ fontSize: 12 }}>
              ml/kg/min
            </p>
          </div>
          <div
            className="ba-card-soft"
            style={{
              padding: "1rem",
              background: "rgba(245,166,35,.1)",
              borderColor: "rgba(245,166,35,.22)",
            }}
          >
            <p className="ba-label">Pace maratona</p>
            <p className="ba-value" style={{ fontSize: 34, color: "#f5a623", marginTop: 8 }}>
              {marathonPaceLabel}
            </p>
            <p className="ba-muted" style={{ fontSize: 12 }}>
              pelo VDOT
            </p>
          </div>
        </div>
      </div>

      <div className="ba-card" style={{ padding: "1.2rem" }}>
        <p className="ba-label">Referência Daniels</p>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginTop: 10 }}>
          Paces de treino
        </h2>
        <div style={{ display: "grid", gap: ".55rem", marginTop: "1rem" }}>
          {trainingPaces.map((item) => (
            <div key={item.label} className="ba-training-pace-row">
              <span className="ba-muted">{item.label}</span>
              <strong style={{ color: "#fff" }}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

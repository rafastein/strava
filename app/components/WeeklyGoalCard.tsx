type WeeklyGoalAlert = {
  title: string;
  text: string;
  ok?: boolean;
};

type WeeklyGoalCardProps = {
  currentKm: number;
  plannedKm: number;
  progressPct: number;
  alerts?: WeeklyGoalAlert[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  className?: string;
};

function isDangerAlert(alert: WeeklyGoalAlert) {
  const title = alert.title.toLowerCase();
  return alert.ok === false || title.includes("abaixo") || title.includes("não");
}

export default function WeeklyGoalCard({
  currentKm,
  plannedKm,
  progressPct,
  alerts = [],
  eyebrow = "Semana atual",
  title = "Meta semanal",
  subtitle = "SisRUN x execução real no Strava.",
  className = "",
}: WeeklyGoalCardProps) {
  const safeProgress = Number.isFinite(progressPct)
    ? Math.max(0, Math.min(progressPct, 100))
    : 0;
  const remainingKm = Math.max(plannedKm - currentKm, 0);

  return (
    <div className={`ba-card ${className}`.trim()} style={{ padding: "1.2rem" }}>
      <div className="ba-card-head">
        <div>
          <p className="ba-label">{eyebrow}</p>
          <h2
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
              marginTop: 10,
            }}
          >
            {title}
          </h2>
          <p className="ba-muted" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        </div>
        <p className="ba-value ba-weekly-goal-value">
          {currentKm.toFixed(1)} / {plannedKm.toFixed(1)} km
        </p>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div className="ba-progress">
          <div className="ba-progress-fill" style={{ width: `${safeProgress}%` }} />
        </div>
        <p className="ba-muted" style={{ marginTop: 10, fontSize: 13 }}>
          Faltam {remainingKm.toFixed(1)} km para cumprir o planejado da semana.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="ba-alert-grid">
          {alerts.map((alert) => {
            const danger = isDangerAlert(alert);
            return (
              <div
                key={alert.title}
                className="ba-card-soft"
                style={{
                  padding: "1rem",
                  borderColor: danger
                    ? "rgba(239,68,68,.18)"
                    : "rgba(245,166,35,.16)",
                }}
              >
                <p
                  style={{
                    color: danger ? "#fca5a5" : "#f5a623",
                    fontWeight: 800,
                  }}
                >
                  {alert.title}
                </p>
                <p
                  className="ba-muted"
                  style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}
                >
                  {alert.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

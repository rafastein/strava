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
    <section className="ba-card ba-performance-compact ba-section">
      <div className="ba-compact-head">
        <div>
          <p className="ba-label">Performance</p>
          <h2 className="ba-compact-title">Performance e paces</h2>
          <p className="ba-muted ba-compact-subtitle">
            Referências atuais calculadas pelos PRs do Strava e pelo VDOT.
          </p>
        </div>

        <span className="ba-vdot-badge">VDOT {vdot.toFixed(1)}</span>
      </div>

      <div className="ba-performance-body">
        <div className="ba-performance-kpi-stack">
          <div className="ba-performance-kpi ba-performance-kpi-blue">
            <p className="ba-label">VO2max</p>
            <strong>{vo2max?.toFixed(1) ?? vdot.toFixed(1)}</strong>
            <span>ml/kg/min</span>
          </div>

          <div className="ba-performance-kpi ba-performance-kpi-amber">
            <p className="ba-label">Pace maratona</p>
            <strong>{marathonPaceLabel}</strong>
            <span>pelo VDOT</span>
          </div>
        </div>

        <div className="ba-pace-list ba-pace-list-compact">
          {trainingPaces.map((item) => (
            <div key={item.label} className="ba-pace-list-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

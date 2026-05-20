type RecentLongRunItem = {
  id: number;
  name: string;
  dateLabel: string;
  distanceLabel: string;
  paceLabel: string;
  heartRateLabel?: string;
  elevationLabel?: string;
};

type RecentLongRunsSectionProps = {
  recentLongRuns: RecentLongRunItem[];
};

export default function RecentLongRunsSection({
  recentLongRuns,
}: RecentLongRunsSectionProps) {
  const compactLongRuns = recentLongRuns.slice(0, 4);

  return (
    <section className="ba-card ba-recent-longruns-card ba-section">
      <div className="ba-compact-head">
        <div>
          <p className="ba-label">Longões recentes</p>
          <h2 className="ba-compact-title">Especificidade</h2>
          <p className="ba-muted ba-compact-subtitle">
            Sessões mais úteis para leitura de resistência, ritmo e controle de esforço.
          </p>
        </div>
      </div>

      <div className="ba-recent-longrun-list ba-recent-longrun-list-grid">
        {compactLongRuns.length > 0 ? (
          compactLongRuns.map((run) => (
            <div key={run.id} className="ba-recent-longrun ba-recent-longrun-compact">
              <div className="ba-recent-longrun-topline">
                <div>
                  <p className="ba-recent-longrun-name">{run.name}</p>
                  <p className="ba-muted ba-recent-longrun-date">{run.dateLabel}</p>
                </div>

                <strong className="ba-recent-longrun-distance">{run.distanceLabel}</strong>
              </div>

              <div className="ba-chip-row ba-chip-row-compact">
                <span className="ba-pill ba-pill-dark">{run.paceLabel}</span>
                {run.heartRateLabel && (
                  <span className="ba-pill ba-pill-dark">{run.heartRateLabel}</span>
                )}
                {run.elevationLabel && (
                  <span className="ba-pill ba-pill-dark">{run.elevationLabel}</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="ba-muted">Nenhum longão identificado ainda.</p>
        )}
      </div>
    </section>
  );
}

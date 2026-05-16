import ManualPredictionForm from "../../components/ManualPredictionForm";
import { ProjectionCard } from "../_buenosAiresUtils";

type RecentLongRunItem = {
  id: number;
  name: string;
  dateLabel: string;
  distanceLabel: string;
  paceLabel: string;
  heartRateLabel?: string;
  elevationLabel?: string;
};

type ProjectionSectionProps = {
  targetPredictionLabel: string;
  targetPaceLabel: string;
  bestHalfPredictionLabel: string;
  bestHalfCaption: string;
  longRunPredictionLabel: string;
  longRunCaption: string;
  sitePredictionLabel: string;
  manualPredictionInitialValue: string;
  recentLongRuns: RecentLongRunItem[];
};

export default function ProjectionSection({
  targetPredictionLabel,
  targetPaceLabel,
  bestHalfPredictionLabel,
  bestHalfCaption,
  longRunPredictionLabel,
  longRunCaption,
  sitePredictionLabel,
  manualPredictionInitialValue,
  recentLongRuns,
}: ProjectionSectionProps) {
  return (
    <section className="ba-two" style={{ marginBottom: "1rem" }}>
      <div className="ba-card" style={{ padding: "1.15rem" }}>
        <p className="ba-label">Projeções</p>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 650, marginTop: 8 }}>
          Maratona
        </h2>
        <div className="ba-grid-2" style={{ marginTop: ".9rem", gap: ".75rem" }}>
          <ProjectionCard title="Pace-alvo" value={targetPredictionLabel} caption={targetPaceLabel} />
          <ProjectionCard title="Melhor meia" value={bestHalfPredictionLabel} caption={bestHalfCaption} />
          <ProjectionCard title="Longão forte" value={longRunPredictionLabel} caption={longRunCaption} />
          <ProjectionCard title="Modelo do site" value={sitePredictionLabel} caption="Meia + longão + volume" highlight />
        </div>
        <div className="ba-manual-prediction">
          <ManualPredictionForm initialValue={manualPredictionInitialValue} />
        </div>
      </div>

      <div className="ba-card" style={{ padding: "1.2rem" }}>
        <p className="ba-label">Longões recentes</p>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginTop: 8 }}>
          Especificidade
        </h2>
        <div style={{ display: "grid", gap: ".65rem", marginTop: ".95rem" }}>
          {recentLongRuns.length > 0 ? (
            recentLongRuns.map((run) => (
              <div key={run.id} className="ba-recent-longrun">
                <div className="ba-card-head" style={{ gap: ".75rem" }}>
                  <div>
                    <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>{run.name}</p>
                    <p className="ba-muted" style={{ fontSize: 12, marginTop: 3 }}>
                      {run.dateLabel}
                    </p>
                  </div>
                  <p style={{ color: "#f5a623", fontWeight: 750, fontSize: 13 }}>
                    {run.distanceLabel}
                  </p>
                </div>
                <div className="ba-chip-row">
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
      </div>
    </section>
  );
}

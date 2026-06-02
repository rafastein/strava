import ManualPredictionForm from "../../components/ManualPredictionForm";

type ProjectionSectionProps = {
  targetPredictionLabel: string;
  targetPaceLabel: string;
  bestHalfPredictionLabel: string;
  bestHalfCaption: string;
  longRunPredictionLabel: string;
  longRunCaption: string;
  sitePredictionLabel: string;
  sitePredictionCaption: string;
  manualPredictionInitialValue: string;
};

export default function ProjectionSection({
  targetPredictionLabel,
  targetPaceLabel,
  bestHalfPredictionLabel,
  bestHalfCaption,
  longRunPredictionLabel,
  longRunCaption,
  sitePredictionLabel,
  sitePredictionCaption,
  manualPredictionInitialValue,
}: ProjectionSectionProps) {
  return (
    <section className="ba-card ba-projection-compact ba-section">
      <div className="ba-compact-head">
        <div>
          <p className="ba-label">Projeções</p>
          <h2 className="ba-compact-title">Maratona</h2>
          <p className="ba-muted ba-compact-subtitle">
            Modelos de tempo para Buenos Aires, com destaque para o cenário composto.
          </p>
        </div>
      </div>

      <div className="ba-projection-main">
        <p>Modelo realista atual</p>
        <strong>{sitePredictionLabel}</strong>
        <span>{sitePredictionCaption}</span>
      </div>

      <div className="ba-projection-list">
        <div className="ba-projection-row">
          <div>
            <p>Pace-alvo</p>
            <span>{targetPaceLabel}</span>
          </div>
          <strong>{targetPredictionLabel}</strong>
        </div>

        <div className="ba-projection-row">
          <div>
            <p>Potencial pela meia</p>
            <span>{bestHalfCaption}</span>
          </div>
          <strong>{bestHalfPredictionLabel}</strong>
        </div>

        <div className="ba-projection-row">
          <div>
            <p>Longão forte</p>
            <span>{longRunCaption}</span>
          </div>
          <strong>{longRunPredictionLabel}</strong>
        </div>
      </div>

      <ManualPredictionForm initialValue={manualPredictionInitialValue} />
    </section>
  );
}

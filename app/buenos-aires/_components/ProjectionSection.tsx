import ManualPredictionForm from "../../components/ManualPredictionForm";

type ProjectionSectionProps = {
  targetPredictionLabel: string;
  targetPaceLabel: string;
  bestHalfPredictionLabel: string;
  bestHalfCaption: string;
  bestHalfPaceLabel: string;
  longRunPredictionLabel: string;
  longRunCaption: string;
  longRunPaceLabel: string;
  sitePredictionLabel: string;
  sitePredictionCaption: string;
  sitePredictionPaceLabel: string;
  manualPredictionInitialValue: string;
};

export default function ProjectionSection({
  targetPredictionLabel,
  targetPaceLabel,
  bestHalfPredictionLabel,
  bestHalfCaption,
  bestHalfPaceLabel,
  longRunPredictionLabel,
  longRunCaption,
  longRunPaceLabel,
  sitePredictionLabel,
  sitePredictionCaption,
  sitePredictionPaceLabel,
  manualPredictionInitialValue,
}: ProjectionSectionProps) {
  return (
    <section className="ba-card ba-projection-compact ba-section">
      <div className="ba-compact-head">
        <div>
          <p className="ba-label">Projeções</p>
          <h2 className="ba-compact-title">Maratona</h2>
          <p className="ba-muted ba-compact-subtitle">
            Modelos de tempo para Buenos Aires: Riegel, longão e volume do ciclo.
          </p>
        </div>
      </div>

      <div className="ba-projection-main">
        <p>Modelo Riegel ajustado</p>
        <strong>
          {sitePredictionLabel}
          {sitePredictionPaceLabel && (
            <span className="ba-projection-pace"> · {sitePredictionPaceLabel}</span>
          )}
        </strong>
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
          <strong>
            {bestHalfPredictionLabel}
            {bestHalfPaceLabel && bestHalfPredictionLabel !== "—" && (
              <span className="ba-projection-pace"> · {bestHalfPaceLabel}</span>
            )}
          </strong>
        </div>

        <div className="ba-projection-row">
          <div>
            <p>Longão forte</p>
            <span>{longRunCaption}</span>
          </div>
          <strong>
            {longRunPredictionLabel}
            {longRunPaceLabel && longRunPredictionLabel !== "—" && (
              <span className="ba-projection-pace"> · {longRunPaceLabel}</span>
            )}
          </strong>
        </div>
      </div>

      <ManualPredictionForm initialValue={manualPredictionInitialValue} />
    </section>
  );
}
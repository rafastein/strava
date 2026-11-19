import { formatKm, formatNumber } from "../lib/format";
import type { PlannedWorkoutStep } from "../lib/planned-workout";

// Etapas do treino: aquecimento, blocos (repetidos ou não), recuperação e desaquecimento.

const KIND_LABEL: Record<NonNullable<PlannedWorkoutStep["kind"]>, string> = {
  aquecimento: "Aquecimento",
  bloco: "Bloco",
  recuperacao: "Recuperação",
  desaquecimento: "Desaquecimento",
  outro: "Etapa",
};

function amount(step: PlannedWorkoutStep) {
  if (step.distanceKm) return step.distanceKm < 1 ? `${formatNumber(step.distanceKm * 1000)} m` : formatKm(step.distanceKm, step.distanceKm % 1 ? 1 : 0);
  if (step.durationMin) {
    if (step.durationMin < 1) return `${Math.round(step.durationMin * 60)} s`;
    if (step.durationMin >= 60) {
      const hours = Math.floor(step.durationMin / 60);
      const minutes = Math.round(step.durationMin % 60);
      return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
    }
    return `${formatNumber(step.durationMin, step.durationMin % 1 ? 1 : 0)} min`;
  }
  return null;
}

/** "Correr por 5min" → "Correr"; o tempo vai para a coluna da direita. */
function shortLabel(step: PlannedWorkoutStep) {
  const label = step.label.replace(/\s+por\s+.+$/i, "").trim();
  return label || KIND_LABEL[step.kind ?? "outro"];
}

function StepRow({ step, nested = false }: { step: PlannedWorkoutStep; nested?: boolean }) {
  const kind = step.kind ?? "outro";
  return (
    <li className={`wk-step wk-step--${kind}${nested ? " wk-step--nested" : ""}`}>
      <span className="wk-step__bar" aria-hidden="true" />
      <span className="wk-step__main">
        <span className="wk-step__title">
          <span className="sr-only">{KIND_LABEL[kind]}: </span>
          {shortLabel(step)}
          {step.intensity ? <span className="wk-step__zone">{step.intensity}</span> : null}
        </span>
        {step.target ? <span className="ui-muted wk-step__target">pace {step.target}</span> : null}
      </span>
      <span className="wk-step__amount">{amount(step) ?? ""}</span>
    </li>
  );
}

export default function WorkoutSteps({ steps }: { steps: PlannedWorkoutStep[] }) {
  if (!steps.length) return null;
  return (
    <ol className="wk-steps" aria-label="Etapas do treino">
      {steps.map((step, index) =>
        step.children?.length ? (
          <li key={`${step.label}-${index}`} className="wk-group">
            <span className="wk-group__head">{step.repeat ? `${step.repeat}×` : step.label}</span>
            <ol className="wk-steps wk-steps--nested">
              {step.children.map((child, childIndex) => (
                <StepRow key={`${child.label}-${childIndex}`} step={child} nested />
              ))}
            </ol>
          </li>
        ) : (
          <StepRow key={`${step.label}-${index}`} step={step.repeat ? { ...step, label: `${step.repeat}× ${step.label}` } : step} />
        ),
      )}
    </ol>
  );
}

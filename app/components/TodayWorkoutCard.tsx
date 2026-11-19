import { formatKm } from "../lib/format";
import {
  getStructuredWorkoutPlannedDistanceKm,
  getStructuredWorkoutSourceLabel,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkout,
} from "../lib/planned-workout";

type TodayWorkoutStatus = "Sem treino" | "Descanso" | "Pendente" | "Concluído ✓" | "Parcial";

type TodayWorkoutCardProps = {
  todayStravaKm: number;
  structuredWorkout?: StructuredPlannedWorkout | null;
  structuredWorkoutSourceLabel?: string | null;
};

export function getTodayWorkoutStatus(
  todayStravaKm: number,
  structuredWorkout?: StructuredPlannedWorkout | null,
): TodayWorkoutStatus {
  if (!structuredWorkout) return "Sem treino";

  const plannedDistanceKm = getStructuredWorkoutPlannedDistanceKm(structuredWorkout);
  if (!isStructuredRunningWorkout(structuredWorkout) || plannedDistanceKm === 0) return "Descanso";
  if (todayStravaKm <= 0) return "Pendente";
  if (plannedDistanceKm === null || todayStravaKm >= plannedDistanceKm) return "Concluído ✓";
  return "Parcial";
}

export default function TodayWorkoutCard({
  todayStravaKm,
  structuredWorkout,
  structuredWorkoutSourceLabel,
}: TodayWorkoutCardProps) {
  const todayStatus = getTodayWorkoutStatus(todayStravaKm, structuredWorkout);
  const todayOk = todayStatus === "Concluído ✓" || todayStatus === "Descanso";
  const plannedDistanceKm = structuredWorkout ? getStructuredWorkoutPlannedDistanceKm(structuredWorkout) : null;
  const sourceLabel = structuredWorkout
    ? structuredWorkoutSourceLabel ?? getStructuredWorkoutSourceLabel(structuredWorkout.source)
    : null;
  const evidence = structuredWorkout?.steps.slice(0, 3).map((step) => {
    const repeat = step.repeat ? `${step.repeat}x ` : "";
    const distance = step.distanceKm ? ` · ${formatKm(step.distanceKm, step.distanceKm < 1 ? 2 : 1)}` : "";
    const intensity = step.intensity ? ` · ${step.intensity}` : "";
    return `${repeat}${step.label}${distance}${intensity}`;
  }) ?? [];

  const statusColor = todayOk ? "var(--ui-good)" : todayStatus === "Sem treino" ? "var(--ui-muted)" : "var(--ui-accent)";

  return (
    <section className="ui-card ui-card--pad ui-stack" aria-label="Treino de hoje">
      <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
        <p className="ui-label-accent">Treino de hoje</p>
        <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{todayStatus.replace(" ✓", "")}</span>
      </div>

      {structuredWorkout ? (
        <>
          <div>
            <h2 className="ui-h2" style={{ fontSize: 20 }}>{structuredWorkout.title}</h2>
            <p className="ui-muted" style={{ marginTop: 4 }}>fonte: {sourceLabel}</p>
          </div>
          <dl className="ui-dl">
            <div>
              <dt>Planejado</dt>
              <dd>{plannedDistanceKm === null ? "não informado" : formatKm(plannedDistanceKm)}</dd>
            </div>
            <div>
              <dt>Feito no Strava</dt>
              <dd>{formatKm(todayStravaKm)}</dd>
            </div>
          </dl>
          {evidence.length > 0 ? (
            <ul className="ui-list" style={{ listStyle: "none", margin: "0 -20px -20px", borderTop: "1px solid var(--ui-border)" }}>
              {evidence.map((item) => (
                <li key={item} className="ui-row" style={{ minHeight: 44, fontSize: 14, color: "var(--ui-text-2)" }}>{item}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="ui-muted" style={{ fontSize: 14 }}>Nenhum treino previsto para hoje.</p>
      )}
    </section>
  );
}

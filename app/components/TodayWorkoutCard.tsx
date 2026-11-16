import { formatKm } from "../lib/format";
import type { SisrunRow } from "../lib/sisrun-utils";
import {
  getStructuredWorkoutPlannedDistanceKm,
  getStructuredWorkoutSourceLabel,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkout,
} from "../lib/planned-workout";

type TodayWorkoutStatus = "Sem treino" | "Descanso" | "Pendente" | "Concluído ✓" | "Parcial";

type TodayWorkoutCardProps = {
  todaySisrunRow: SisrunRow | null;
  todayStravaKm: number;
  structuredWorkout?: StructuredPlannedWorkout | null;
  structuredWorkoutSourceLabel?: string | null;
};

function getPlannedDistanceKm(
  todaySisrunRow: SisrunRow | null,
  structuredWorkout?: StructuredPlannedWorkout | null,
) {
  const structuredDistance = getStructuredWorkoutPlannedDistanceKm(structuredWorkout);
  if (structuredWorkout && structuredDistance !== null) return structuredDistance;
  return todaySisrunRow?.plannedDistanceKm ?? null;
}

export function getTodayWorkoutStatus(
  todaySisrunRow: SisrunRow | null,
  todayStravaKm: number,
  structuredWorkout?: StructuredPlannedWorkout | null,
): TodayWorkoutStatus {
  if (structuredWorkout) {
    const plannedDistanceKm = getStructuredWorkoutPlannedDistanceKm(structuredWorkout);
    const isRunning = isStructuredRunningWorkout(structuredWorkout);

    if (!isRunning || plannedDistanceKm === 0) return "Descanso";
    if (todayStravaKm <= 0) return "Pendente";
    if (plannedDistanceKm === null) return "Concluído ✓";
    if (todayStravaKm >= plannedDistanceKm) return "Concluído ✓";
    return "Parcial";
  }

  if (!todaySisrunRow) return "Sem treino";
  if (todaySisrunRow.plannedDistanceKm === 0) return "Descanso";
  if (todayStravaKm <= 0) return "Pendente";
  if (todayStravaKm >= todaySisrunRow.plannedDistanceKm) return "Concluído ✓";
  return "Parcial";
}

function getWorkoutTitle(
  todaySisrunRow: SisrunRow | null,
  structuredWorkout?: StructuredPlannedWorkout | null,
) {
  if (structuredWorkout) return structuredWorkout.title;
  if (!todaySisrunRow) return "Nenhum treino previsto.";
  return todaySisrunRow.plannedDistanceKm > 0 ? `${formatKm(todaySisrunRow.plannedDistanceKm)} na planilha` : "Descanso";
}

function getSourceLabel(
  structuredWorkout?: StructuredPlannedWorkout | null,
  structuredWorkoutSourceLabel?: string | null,
) {
  if (!structuredWorkout) return "SisRUN";
  return structuredWorkoutSourceLabel ?? getStructuredWorkoutSourceLabel(structuredWorkout.source);
}

export default function TodayWorkoutCard({
  todaySisrunRow,
  todayStravaKm,
  structuredWorkout,
  structuredWorkoutSourceLabel,
}: TodayWorkoutCardProps) {
  const todayStatus = getTodayWorkoutStatus(todaySisrunRow, todayStravaKm, structuredWorkout);
  const todayOk = todayStatus === "Concluído ✓" || todayStatus === "Descanso";
  const plannedDistanceKm = getPlannedDistanceKm(todaySisrunRow, structuredWorkout);
  const sourceLabel = getSourceLabel(structuredWorkout, structuredWorkoutSourceLabel);
  const evidence = structuredWorkout?.steps.slice(0, 3).map((step) => {
    const repeat = step.repeat ? `${step.repeat}x ` : "";
    const distance = step.distanceKm ? ` · ${formatKm(step.distanceKm, step.distanceKm < 1 ? 2 : 1)}` : "";
    const intensity = step.intensity ? ` · ${step.intensity}` : "";
    return `${repeat}${step.label}${distance}${intensity}`;
  }) ?? [];

  const hasWorkout = Boolean(structuredWorkout || todaySisrunRow);
  const statusColor = todayOk ? "var(--ui-good)" : todayStatus === "Sem treino" ? "var(--ui-muted)" : "var(--ui-accent)";

  return (
    <section className="ui-card ui-card--pad ui-stack" aria-label="Treino de hoje">
      <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
        <p className="ui-label-accent">Treino de hoje</p>
        <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{todayStatus.replace(" ✓", "")}</span>
      </div>

      {hasWorkout ? (
        <>
          <div>
            <h2 className="ui-h2" style={{ fontSize: 20 }}>{getWorkoutTitle(todaySisrunRow, structuredWorkout)}</h2>
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

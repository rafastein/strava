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
  return `Planejado: ${todaySisrunRow.plannedDistanceKm.toFixed(1)} km`;
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
    const distance = step.distanceKm ? ` · ${step.distanceKm.toFixed(2)} km` : "";
    const intensity = step.intensity ? ` · ${step.intensity}` : "";
    return `${repeat}${step.label}${distance}${intensity}`;
  }) ?? [];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "1.5rem",
      }}
    >
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          marginBottom: "0.75rem",
        }}
      >
        Hoje · {sourceLabel}
      </p>

      {structuredWorkout || todaySisrunRow ? (
        <>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 4,
            }}
          >
            {getWorkoutTitle(todaySisrunRow, structuredWorkout)}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 4,
            }}
          >
            Planejado: {plannedDistanceKm === null ? "distância não informada" : `${plannedDistanceKm.toFixed(1)} km`}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 12,
            }}
          >
            Strava: {todayStravaKm.toFixed(1)} km
          </p>

          {evidence.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {evidence.map((item) => (
                <span
                  key={item}
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    color: "rgba(255,255,255,0.55)",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 12,
          }}
        >
          Nenhum treino previsto.
        </p>
      )}

      <span
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          background: todayOk ? "rgba(16,185,129,0.15)" : "rgba(245,166,35,0.15)",
          color: todayOk ? "#10b981" : "#f5a623",
          border: `1px solid ${todayOk ? "rgba(16,185,129,0.3)" : "rgba(245,166,35,0.3)"}`,
        }}
      >
        {todayStatus}
      </span>
    </div>
  );
}

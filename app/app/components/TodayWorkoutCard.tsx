import type { SisrunRow } from "../lib/sisrun-utils";

type TodayWorkoutStatus = "Sem treino" | "Descanso" | "Pendente" | "Concluído ✓" | "Parcial";

type TodayWorkoutCardProps = {
  todaySisrunRow: SisrunRow | null;
  todayStravaKm: number;
};

export function getTodayWorkoutStatus(
  todaySisrunRow: SisrunRow | null,
  todayStravaKm: number,
): TodayWorkoutStatus {
  if (!todaySisrunRow) return "Sem treino";
  if (todaySisrunRow.plannedDistanceKm === 0) return "Descanso";
  if (todayStravaKm <= 0) return "Pendente";
  if (todayStravaKm >= todaySisrunRow.plannedDistanceKm) return "Concluído ✓";
  return "Parcial";
}

export default function TodayWorkoutCard({
  todaySisrunRow,
  todayStravaKm,
}: TodayWorkoutCardProps) {
  const todayStatus = getTodayWorkoutStatus(todaySisrunRow, todayStravaKm);
  const todayOk = todayStatus === "Concluído ✓" || todayStatus === "Descanso";

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
        Hoje
      </p>

      {todaySisrunRow ? (
        <>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 4,
            }}
          >
            Planejado: {todaySisrunRow.plannedDistanceKm.toFixed(1)} km
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

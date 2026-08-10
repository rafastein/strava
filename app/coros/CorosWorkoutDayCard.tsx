import type { CalendarCell, SavedRaceCard, WorkoutDeleteHandler } from "./types";
import {
  deleteButtonStyle,
  formatCompletionRatio,
  formatDistance,
  formatPlannedWorkoutSummary,
  getDateLabelStyle,
  getDayCellStyle,
  getMobileDayCellStyle,
} from "./coros-calendar-utils";

type Props = {
  cell: CalendarCell;
  isDeleting: boolean;
  adminSecret: string;
  weekday?: string;
  layout: "desktop" | "mobile";
  onDelete: WorkoutDeleteHandler;
};

function RaceDetails({ race, compact = false }: { race: SavedRaceCard; compact?: boolean }) {
  return (
    <div
      style={{
        marginTop: compact ? 7 : 9,
        borderRadius: 12,
        border: "1px solid rgba(249,115,22,0.28)",
        background: "rgba(249,115,22,0.08)",
        padding: compact ? ".55rem .65rem" : ".65rem .75rem",
      }}
    >
      <p style={{ color: "#fdba74", fontSize: 10, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Prova{race.isGoal ? " · alvo" : ""}
      </p>
      <p style={{ marginTop: 3, color: "var(--text)", fontSize: compact ? 12 : 13, fontWeight: 800, lineHeight: 1.25 }}>
        {race.name}
      </p>
      <p className="ba-muted" style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35 }}>
        {formatDistance(race.distanceKm)} · {race.location}
      </p>
      {race.objective && (
        <p className="ba-muted" style={{ marginTop: 3, fontSize: 11, lineHeight: 1.35 }}>
          Objetivo · {race.objective}
        </p>
      )}
      {race.actualKm && race.actualKm > 0 && (
        <p className="ba-muted" style={{ marginTop: 3, fontSize: 11 }}>
          Feito · {formatDistance(race.actualKm)}{formatCompletionRatio(race)}
        </p>
      )}
    </div>
  );
}

export default function CorosWorkoutDayCard({ cell, isDeleting, adminSecret, weekday, layout, onDelete }: Props) {
  const workout = cell.workout;
  const hasRace = cell.races.length > 0;
  const isMobile = layout === "mobile";

  if (isMobile) {
    return (
      <div style={getMobileDayCellStyle(cell)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ba-label" style={getDateLabelStyle(cell)}>
              {weekday} · {cell.dayNumber}
              {cell.isToday ? " · Hoje" : ""}
            </p>
            <p style={{ marginTop: 6, fontWeight: 800, color: "var(--text)", fontSize: 15, lineHeight: 1.3 }}>
              {hasRace ? cell.races[0].name : workout?.type ?? "Sem treino estruturado"}
            </p>
          </div>
          {workout && <DeleteWorkoutButton workoutDateLabel={workout.dateLabel} disabled={!adminSecret || isDeleting} isDeleting={isDeleting} onClick={() => onDelete(workout)} />}
        </div>

        {cell.races.map((race) => <RaceDetails key={race.id} race={race} />)}

        {workout ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <p className="ba-muted" style={{ fontSize: 13 }}>
              COROS · <strong style={{ color: "var(--text)" }}>{workout.type}</strong> · {formatPlannedWorkoutSummary(workout)}
            </p>
            {workout.actualKm && workout.actualKm > 0 && !hasRace && (
              <p className="ba-muted" style={{ fontSize: 13 }}>Feito · {formatDistance(workout.actualKm)}{formatCompletionRatio(workout)}</p>
            )}
          </div>
        ) : !hasRace ? (
          <p className="ba-muted" style={{ marginTop: 10, fontSize: 13 }}>Dia sem treino estruturado.</p>
        ) : null}

        {(workout || hasRace) && (
          <p className="ba-muted" style={{ marginTop: 8, fontSize: 13 }}>Tênis · {cell.shoeName ?? "sem recomendação"}</p>
        )}
      </div>
    );
  }

  return (
    <div style={getDayCellStyle(cell)}>
      <div className="flex items-start justify-between gap-2">
        <p className="ba-label" style={getDateLabelStyle(cell)}>
          {cell.dayNumber}
          {cell.isToday ? " · Hoje" : ""}
        </p>

        {workout && <DeleteWorkoutButton workoutDateLabel={workout.dateLabel} disabled={!adminSecret || isDeleting} isDeleting={isDeleting} onClick={() => onDelete(workout)} />}
      </div>

      {cell.races.map((race) => <RaceDetails key={race.id} race={race} compact />)}

      {workout ? (
        <div style={{ marginTop: hasRace ? 8 : 10 }}>
          <p style={{ fontWeight: 800, color: "var(--text)", fontSize: 13, lineHeight: 1.3 }}>
            {hasRace ? `COROS · ${workout.type}` : workout.type}
          </p>
          <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
            Planejado · {formatPlannedWorkoutSummary(workout)}
          </p>
          {workout.actualKm && workout.actualKm > 0 && !hasRace && (
            <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
              Feito · {formatDistance(workout.actualKm)}{formatCompletionRatio(workout)}
            </p>
          )}
        </div>
      ) : !hasRace ? (
        <div style={{ marginTop: 10 }}>
          <p className="ba-muted" style={{ fontSize: 12, color: cell.inCurrentMonth ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}>
            Sem treino estruturado.
          </p>
        </div>
      ) : null}

      {(workout || hasRace) && (
        <p className="ba-muted" style={{ marginTop: 6, fontSize: 12 }}>
          Tênis · {cell.shoeName ?? "sem recomendação"}
        </p>
      )}
    </div>
  );
}

function DeleteWorkoutButton({ workoutDateLabel, disabled, isDeleting, onClick }: { workoutDateLabel: string; disabled: boolean; isDeleting: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Informe o ADMIN_SECRET para excluir" : `Excluir ${workoutDateLabel}`}
      style={deleteButtonStyle}
    >
      {isDeleting ? "..." : "Excluir"}
    </button>
  );
}

import type { CalendarCell, WorkoutDeleteHandler } from "./types";
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

export default function CorosWorkoutDayCard({ cell, isDeleting, adminSecret, weekday, layout, onDelete }: Props) {
  const workout = cell.workout;
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
              {workout?.type ?? "Sem treino estruturado"}
            </p>
          </div>
          {workout && <DeleteWorkoutButton workoutDateLabel={workout.dateLabel} disabled={!adminSecret || isDeleting} isDeleting={isDeleting} onClick={() => onDelete(workout)} />}
        </div>

        {workout ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <p className="ba-muted" style={{ fontSize: 13 }}>Planejado · {formatPlannedWorkoutSummary(workout)}</p>
            {workout.actualKm && workout.actualKm > 0 && (
              <p className="ba-muted" style={{ fontSize: 13 }}>Feito · {formatDistance(workout.actualKm)}{formatCompletionRatio(workout)}</p>
            )}
            <p className="ba-muted" style={{ fontSize: 13 }}>Tênis · {workout.shoeName ?? "sem recomendação"}</p>
          </div>
        ) : (
          <p className="ba-muted" style={{ marginTop: 10, fontSize: 13 }}>Dia sem treino estruturado.</p>
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

      {workout ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontWeight: 800, color: "var(--text)", fontSize: 13, lineHeight: 1.3 }}>
            {workout.type}
          </p>
          <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
            Planejado · {formatPlannedWorkoutSummary(workout)}
          </p>
          {workout.actualKm && workout.actualKm > 0 && (
            <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
              Feito · {formatDistance(workout.actualKm)}{formatCompletionRatio(workout)}
            </p>
          )}
          <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
            Tênis · {workout.shoeName ?? "sem recomendação"}
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <p className="ba-muted" style={{ fontSize: 12, color: cell.inCurrentMonth ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}>
            Sem treino estruturado.
          </p>
        </div>
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

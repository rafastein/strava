"use client";

import { useMemo, useState } from "react";
import { fetchWithAdminRetry } from "../lib/admin-client";
import { formatDayMonth, formatWeekdayShort } from "../lib/format";
import type { CalendarCell, SavedRaceCard, SavedWorkoutCard, WorkoutCompletionStatus } from "./types";
import {
  buildCalendarCells,
  buildMonthOptions,
  formatCompletionRatio,
  formatDistance,
  formatPlannedWorkoutSummary,
  getInitialMonthKey,
} from "./coros-calendar-utils";

type DeleteResponse = {
  success?: boolean;
  key?: string;
  error?: string;
};

const STATUS_META: Record<WorkoutCompletionStatus | "empty", { label: string; color: string }> = {
  done: { label: "Feito", color: "var(--ui-good)" },
  off_target: { label: "Fora da margem", color: "var(--ui-accent)" },
  today: { label: "Hoje", color: "var(--ui-blue)" },
  missed: { label: "Não feito", color: "#ff8a7a" },
  future: { label: "Futuro", color: "var(--ui-muted)" },
  empty: { label: "", color: "var(--ui-muted)" },
};

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

function getRaceStatus(race: SavedRaceCard): WorkoutCompletionStatus {
  return race.status;
}

export default function CorosSavedWorkoutsList({ workouts, races, todayDate }: { workouts: SavedWorkoutCard[]; races: SavedRaceCard[]; todayDate?: string }) {
  const [items, setItems] = useState(workouts);
  const [editing, setEditing] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions([...items, ...races]), [items, races]);
  const [currentMonthKey, setCurrentMonthKey] = useState(() => getInitialMonthKey(monthOptions, todayDate));

  const effectiveMonthKey = monthOptions.some((month) => month.key === currentMonthKey)
    ? currentMonthKey
    : getInitialMonthKey(monthOptions, todayDate);

  const activeMonth = monthOptions.find((month) => month.key === effectiveMonthKey) ?? null;
  const currentMonthIndex = monthOptions.findIndex((month) => month.key === effectiveMonthKey);

  const monthItems = useMemo(
    () => items.filter((item) => item.date.startsWith(`${effectiveMonthKey}-`)).sort((a, b) => a.date.localeCompare(b.date)),
    [effectiveMonthKey, items],
  );

  const monthRaces = useMemo(
    () => races.filter((race) => race.date.startsWith(`${effectiveMonthKey}-`)).sort((a, b) => a.date.localeCompare(b.date)),
    [effectiveMonthKey, races],
  );

  // Só os dias com treino ou prova: a agenda fica curta e sem células vazias.
  const agendaDays = useMemo(() => {
    if (!activeMonth) return [] as CalendarCell[];
    const workoutByDate = new Map(monthItems.map((item) => [item.date, item]));
    const racesByDate = new Map<string, SavedRaceCard[]>();
    monthRaces.forEach((race) => racesByDate.set(race.date, [...(racesByDate.get(race.date) ?? []), race]));
    return buildCalendarCells(activeMonth.year, activeMonth.monthIndex, workoutByDate, racesByDate, todayDate)
      .filter((cell) => cell.inCurrentMonth && (cell.workout || cell.races.length > 0));
  }, [activeMonth, monthItems, monthRaces, todayDate]);

  async function handleDelete(workout: SavedWorkoutCard) {
    const confirmed = window.confirm(`Excluir o treino de ${workout.dateLabel}?\n\n${workout.title}`);
    if (!confirmed) return;

    setDeletingDate(workout.date);
    setFeedback(null);

    try {
      // Pede a senha administrativa só se o servidor recusar a primeira tentativa.
      const response = await fetchWithAdminRetry(`/api/planned-workout?date=${encodeURIComponent(workout.date)}`, { method: "DELETE" });
      const body = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Falha ao excluir treino.");
      }

      setItems((current) => current.filter((item) => item.date !== workout.date));
      setFeedback({ type: "success", message: `Treino de ${workout.dateLabel} excluído.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao excluir treino.",
      });
    } finally {
      setDeletingDate(null);
    }
  }

  if (items.length === 0 && races.length === 0) {
    return <p className="ui-card ui-card--pad ui-muted">Nenhum treino do COROS nem prova cadastrada para mostrar.</p>;
  }

  const hasPrevMonth = currentMonthIndex > 0;
  const hasNextMonth = currentMonthIndex >= 0 && currentMonthIndex < monthOptions.length - 1;

  return (
    <div className="hoje-col">
      <div className="coros-monthbar">
        <button
          type="button"
          className="ui-icon-btn"
          aria-label="Mês anterior"
          disabled={!hasPrevMonth}
          onClick={() => hasPrevMonth && setCurrentMonthKey(monthOptions[currentMonthIndex - 1].key)}
        >
          <Chevron direction="left" />
        </button>
        <select
          className="ui-field coros-monthbar__select"
          aria-label="Mês da agenda"
          value={effectiveMonthKey}
          onChange={(event) => setCurrentMonthKey(event.target.value)}
        >
          {monthOptions.map((month) => (
            <option key={month.key} value={month.key}>{month.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="ui-icon-btn"
          aria-label="Próximo mês"
          disabled={!hasNextMonth}
          onClick={() => hasNextMonth && setCurrentMonthKey(monthOptions[currentMonthIndex + 1].key)}
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div className="ui-section__head" style={{ alignItems: "center" }}>
        <span className="ui-muted">
          {monthItems.length} {monthItems.length === 1 ? "treino" : "treinos"} · {monthRaces.length} {monthRaces.length === 1 ? "prova" : "provas"}
        </span>
        {monthItems.length > 0 ? (
          <button type="button" className="ui-btn ui-btn--ghost" style={{ cursor: "pointer" }} aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
            {editing ? "Concluir" : "Editar"}
          </button>
        ) : null}
      </div>

      {feedback ? (
        <p className="ui-card ui-card--pad" role="status" style={{ color: feedback.type === "success" ? "var(--ui-good)" : "#ff8a7a", fontWeight: 600 }}>
          {feedback.message}
        </p>
      ) : null}

      {agendaDays.length === 0 ? (
        <p className="ui-card ui-card--pad ui-muted">Nada planejado neste mês.</p>
      ) : (
        <div className="ui-card ui-list">
          {agendaDays.map((cell) => {
            const workout = cell.workout;
            const race = cell.races[0];
            const status = race ? getRaceStatus(race) : cell.status;
            const meta = STATUS_META[status];
            const done = race ? race.actualKm : workout?.actualKm;
            const [day] = formatDayMonth(cell.isoDate).split(" ");
            const lines = [
              race ? [formatDistance(race.distanceKm), race.location, race.objective].filter(Boolean).join(" · ") : null,
              workout ? `${race ? `COROS: ${workout.type} · ` : ""}${formatPlannedWorkoutSummary(workout) || workout.title}` : null,
              done && done > 0 ? `Feito ${formatDistance(done)}${formatCompletionRatio(race ?? workout!)}` : null,
              cell.shoeName ? `Tênis: ${cell.shoeName}` : null,
            ].filter(Boolean);

            return (
              <div key={cell.isoDate} className="ui-row ui-row--date" style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
                <span className="ui-date">
                  <span className="ui-date__day">{day}</span>
                  <span className="ui-muted" style={{ fontSize: 12 }}>{formatWeekdayShort(cell.isoDate)}</span>
                </span>
                <span className="ui-row__main">
                  <span className="ui-row__title" style={{ whiteSpace: "normal" }}>
                    {race ? race.name : workout?.type}
                    {race ? <span className="ui-tag-accent"> · prova{race.isGoal ? " alvo" : ""}</span> : null}
                  </span>
                  {!race && workout && workout.title !== workout.type ? (
                    <span className="ui-muted" style={{ color: "var(--ui-text-2)" }}>{workout.title}</span>
                  ) : null}
                  {lines.map((line) => (
                    <span key={line} className="ui-muted">{line}</span>
                  ))}
                </span>
                <span className="ui-row__side" style={{ gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
                  {editing && workout ? (
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      style={{ cursor: "pointer", color: "#ff8a7a", padding: "0 12px" }}
                      disabled={deletingDate === workout.date}
                      onClick={() => handleDelete(workout)}
                    >
                      {deletingDate === workout.date ? "Excluindo…" : "Excluir"}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="ui-muted" style={{ padding: "0 4px" }}>
        Feito = 80 a 120% do planejado. Em dia de prova, o tênis recomendado segue a prova.
      </p>
    </div>
  );
}

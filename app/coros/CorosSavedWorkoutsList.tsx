"use client";

import { useMemo, useState } from "react";
import CorosCalendarDesktop from "./CorosCalendarDesktop";
import CorosCalendarLegend from "./CorosCalendarLegend";
import CorosCalendarMobile from "./CorosCalendarMobile";
import type { CalendarCell, SavedWorkoutCard } from "./types";
import {
  buildCalendarCells,
  buildMonthOptions,
  fieldStyle,
  getInitialMonthKey,
  navButtonStyle,
  selectStyle,
} from "./coros-calendar-utils";

type DeleteResponse = {
  success?: boolean;
  key?: string;
  error?: string;
};

export default function CorosSavedWorkoutsList({ workouts, todayDate }: { workouts: SavedWorkoutCard[]; todayDate?: string }) {
  const [items, setItems] = useState(workouts);
  const [adminSecret, setAdminSecret] = useState("");
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions(items), [items]);
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

  const workoutByDate = useMemo(() => new Map(monthItems.map((item) => [item.date, item])), [monthItems]);
  const calendarCells = useMemo(() => {
    if (!activeMonth) return [] as CalendarCell[];
    return buildCalendarCells(activeMonth.year, activeMonth.monthIndex, workoutByDate, todayDate);
  }, [activeMonth, todayDate, workoutByDate]);
  const monthVisibleCells = useMemo(() => calendarCells.filter((cell) => cell.inCurrentMonth), [calendarCells]);

  async function handleDelete(workout: SavedWorkoutCard) {
    const confirmed = window.confirm(`Excluir o treino de ${workout.dateLabel}?\n\n${workout.title}`);
    if (!confirmed) return;

    setDeletingDate(workout.date);
    setFeedback(null);

    try {
      const response = await fetch(`/api/planned-workout?date=${encodeURIComponent(workout.date)}`, {
        method: "DELETE",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const body = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Falha ao excluir treino.");
      }

      setItems((current) => current.filter((item) => item.date !== workout.date));
      setFeedback({ type: "success", message: `Treino de ${workout.dateLabel} excluído do Upstash.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao excluir treino.",
      });
    } finally {
      setDeletingDate(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="ba-muted" style={{ marginTop: "1rem", fontSize: 13 }}>
        Nenhum treino estruturado salvo no Upstash. Importe a agenda COROS abaixo para preencher esta lista.
      </p>
    );
  }

  const hasPrevMonth = currentMonthIndex > 0;
  const hasNextMonth = currentMonthIndex >= 0 && currentMonthIndex < monthOptions.length - 1;

  return (
    <div className="mt-4 grid gap-4">
      <AdminSecretCard adminSecret={adminSecret} onAdminSecretChange={setAdminSecret} />

      {feedback && (
        <div className="ba-card-soft" style={{ padding: ".9rem 1rem" }}>
          <p style={{ color: feedback.type === "success" ? "#86efac" : "#fca5a5", fontWeight: 800, fontSize: 13 }}>
            {feedback.message}
          </p>
        </div>
      )}

      <div className="ba-card-soft" style={{ padding: "1rem" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="ba-label">Visualização mensal</p>
            <p style={{ marginTop: 6, fontWeight: 800, color: "var(--text)", fontSize: 18 }}>
              {activeMonth?.label ?? "Calendário"}
            </p>
            <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>
              {monthItems.length} treino{monthItems.length === 1 ? "" : "s"} com distância exibida por dia.
            </p>
          </div>

          <div className="coros-calendar-controls">
            <button
              type="button"
              disabled={!hasPrevMonth}
              onClick={() => hasPrevMonth && setCurrentMonthKey(monthOptions[currentMonthIndex - 1].key)}
              style={navButtonStyle(!hasPrevMonth)}
            >
              ←
            </button>
            <select
              value={effectiveMonthKey}
              onChange={(event) => setCurrentMonthKey(event.target.value)}
              style={selectStyle}
            >
              {monthOptions.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!hasNextMonth}
              onClick={() => hasNextMonth && setCurrentMonthKey(monthOptions[currentMonthIndex + 1].key)}
              style={navButtonStyle(!hasNextMonth)}
            >
              →
            </button>
          </div>
        </div>

        <CorosCalendarLegend />
        <CorosCalendarDesktop cells={calendarCells} adminSecret={adminSecret} deletingDate={deletingDate} onDelete={handleDelete} />
        <CorosCalendarMobile cells={monthVisibleCells} adminSecret={adminSecret} deletingDate={deletingDate} onDelete={handleDelete} />
      </div>
    </div>
  );
}

function AdminSecretCard({ adminSecret, onAdminSecretChange }: { adminSecret: string; onAdminSecretChange: (value: string) => void }) {
  return (
    <div className="ba-card-soft" style={{ padding: "1rem" }}>
      <label className="grid gap-2 md:max-w-md">
        <span className="ba-label">ADMIN_SECRET para excluir treinos</span>
        <input
          value={adminSecret}
          onChange={(event) => onAdminSecretChange(event.target.value)}
          type="password"
          placeholder="Senha administrativa da Vercel"
          style={fieldStyle}
        />
      </label>
      <p className="ba-muted" style={{ marginTop: ".6rem", fontSize: 12 }}>
        A exclusão remove a chave <strong>planned-workout:AAAA-MM-DD</strong> do Upstash.
      </p>
    </div>
  );
}

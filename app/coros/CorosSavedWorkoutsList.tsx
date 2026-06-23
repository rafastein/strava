"use client";

import { useMemo, useState, type CSSProperties } from "react";

type SavedWorkoutCard = {
  redisKey: string;
  date: string;
  dateLabel: string;
  title: string;
  sourceLabel: string;
  type: string;
  shoeName: string | null;
  distanceKm?: number | null;
  completed?: boolean;
};

type DeleteResponse = {
  success?: boolean;
  key?: string;
  error?: string;
};

type MonthOption = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
};

const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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
      <div className="ba-card-soft" style={{ padding: "1rem" }}>
        <label className="grid gap-2 md:max-w-md">
          <span className="ba-label">ADMIN_SECRET para excluir treinos</span>
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            type="password"
            placeholder="Senha administrativa da Vercel"
            style={fieldStyle}
          />
        </label>
        <p className="ba-muted" style={{ marginTop: ".6rem", fontSize: 12 }}>
          A exclusão remove a chave <strong>planned-workout:AAAA-MM-DD</strong> do Upstash.
        </p>
      </div>

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

          <div className="flex items-center gap-2">
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

        <div style={weekdayHeaderGridStyle}>
          {WEEKDAY_HEADERS.map((weekday) => (
            <div key={weekday} style={weekdayHeaderStyle}>
              {weekday}
            </div>
          ))}
        </div>

        <div style={calendarGridStyle}>
          {calendarCells.map((cell) => {
            const workout = cell.workout;
            const isDeleting = deletingDate === workout?.date;

            return (
              <div key={cell.isoDate} style={getDayCellStyle(cell)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className="ba-label"
                      style={cell.isToday
                        ? { color: cell.isCompleted ? "#86efac" : "#93c5fd" }
                        : cell.inCurrentMonth
                          ? undefined
                          : fadedLabelStyle}
                    >
                      {cell.dayNumber}
                      {cell.isToday ? " · Hoje" : ""}
                    </p>
                  </div>

                  {workout && (
                    <button
                      type="button"
                      disabled={!adminSecret || isDeleting}
                      onClick={() => handleDelete(workout)}
                      title={!adminSecret ? "Informe o ADMIN_SECRET para excluir" : `Excluir ${workout.dateLabel}`}
                      style={deleteButtonStyle}
                    >
                      {isDeleting ? "..." : "Excluir"}
                    </button>
                  )}
                </div>

                {workout ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontWeight: 800, color: "var(--text)", fontSize: 13, lineHeight: 1.3 }}>
                      {workout.type}
                    </p>
                    <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
                      Distância · {formatDistance(workout.distanceKm)}
                    </p>
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
          })}
        </div>
      </div>
    </div>
  );
}


type CalendarCell = {
  isoDate: string;
  dayNumber: number;
  shortDateLabel: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isCompleted: boolean;
  isPending: boolean;
  workout?: SavedWorkoutCard;
};

function buildMonthOptions(items: SavedWorkoutCard[]): MonthOption[] {
  const unique = Array.from(new Set(items.map((item) => item.date.slice(0, 7)))).sort();

  return unique.map((key) => {
    const [yearRaw, monthRaw] = key.split("-");
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;

    return {
      key,
      year,
      monthIndex,
      label: `${MONTH_NAMES[monthIndex]} ${year}`,
    };
  });
}

function getInitialMonthKey(monthOptions: MonthOption[], todayDate?: string) {
  if (todayDate) {
    const todayMonthKey = todayDate.slice(0, 7);
    if (monthOptions.some((month) => month.key === todayMonthKey)) return todayMonthKey;
  }

  return monthOptions[monthOptions.length - 1]?.key ?? "";
}

function parseIsoDate(isoDate: string) {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDistance(distanceKm?: number | null) {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return "não informada";
  return `${distanceKm.toFixed(1)} km`;
}

function buildCalendarCells(
  year: number,
  monthIndex: number,
  workoutByDate: Map<string, SavedWorkoutCard>,
  todayDate?: string,
): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const mondayStartOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayStartOffset);
  const sundayEndOffset = (7 - ((lastOfMonth.getDay() + 6) % 7) - 1 + 7) % 7;
  const gridEnd = new Date(year, monthIndex, lastOfMonth.getDate() + sundayEndOffset);

  const cells: CalendarCell[] = [];
  for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
    const isoDate = formatIsoDate(date);
    const workout = workoutByDate.get(isoDate);
    const isToday = todayDate === isoDate;
    const isCompleted = Boolean(workout?.completed);
    const isPending = Boolean(workout) && !isCompleted;
    cells.push({
      isoDate,
      dayNumber: date.getDate(),
      shortDateLabel: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday,
      isCompleted,
      isPending,
      workout,
    });
  }

  return cells;
}

function getDayCellStyle(cell: CalendarCell): CSSProperties {
  const base: CSSProperties = {
    minHeight: 168,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: cell.inCurrentMonth ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)",
    padding: ".85rem",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  };

  if (cell.isCompleted) {
    base.background = "linear-gradient(180deg, rgba(16,185,129,0.16), rgba(255,255,255,0.035))";
    base.border = "1px solid rgba(16,185,129,0.28)";
    base.boxShadow = "0 0 0 1px rgba(16,185,129,0.08) inset";
    return base;
  }

  if (cell.isToday && cell.workout) {
    base.background = "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(255,255,255,0.035))";
    base.border = "1px solid rgba(59,130,246,0.28)";
    base.boxShadow = "0 0 0 1px rgba(59,130,246,0.08) inset";
    return base;
  }

  if (cell.isPending) {
    base.background = "linear-gradient(180deg, rgba(239,68,68,0.12), rgba(255,255,255,0.03))";
    base.border = "1px solid rgba(239,68,68,0.24)";
    base.boxShadow = "0 0 0 1px rgba(239,68,68,0.06) inset";
  }

  return base;
}

const fadedLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.25)",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".8rem 1rem",
  outline: "none",
  fontSize: 13,
};

const selectStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".65rem .9rem",
  outline: "none",
  fontSize: 13,
  minWidth: 180,
};

function navButtonStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
    color: disabled ? "rgba(255,255,255,0.28)" : "var(--text)",
    padding: ".65rem .85rem",
    fontSize: 13,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const weekdayHeaderGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
  marginTop: "1rem",
  marginBottom: ".6rem",
};

const weekdayHeaderStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 800,
  textAlign: "center",
};

const calendarGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
};

const deleteButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(252,165,165,0.35)",
  background: "rgba(127,29,29,0.18)",
  color: "#fecaca",
  padding: ".35rem .65rem",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

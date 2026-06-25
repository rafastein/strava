import type { CSSProperties } from "react";
import type { CalendarCell, MonthOption, SavedWorkoutCard } from "./types";

export const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

export function buildMonthOptions(items: SavedWorkoutCard[]): MonthOption[] {
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

export function getInitialMonthKey(monthOptions: MonthOption[], todayDate?: string) {
  if (todayDate) {
    const todayMonthKey = todayDate.slice(0, 7);
    if (monthOptions.some((month) => month.key === todayMonthKey)) return todayMonthKey;
  }

  return monthOptions[monthOptions.length - 1]?.key ?? "";
}

export function parseIsoDate(isoDate: string) {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDistance(distanceKm?: number | null) {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return "não informada";
  return `${distanceKm.toFixed(1)} km`;
}

export function formatPlannedWorkoutSummary(workout: SavedWorkoutCard) {
  return [
    formatDistance(workout.distanceKm),
    workout.loadTl ? `${Math.round(workout.loadTl)} TL` : null,
    workout.estimatedTime ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatCompletionRatio(workout: SavedWorkoutCard) {
  const plannedKm = workout.distanceKm;
  const actualKm = workout.actualKm;

  if (
    typeof plannedKm !== "number" ||
    !Number.isFinite(plannedKm) ||
    plannedKm <= 0 ||
    typeof actualKm !== "number" ||
    !Number.isFinite(actualKm) ||
    actualKm <= 0
  ) {
    return "";
  }

  return ` · ${Math.round((actualKm / plannedKm) * 100)}%`;
}

export function buildCalendarCells(
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
    cells.push({
      isoDate,
      dayNumber: date.getDate(),
      shortDateLabel: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday,
      status: workout?.status ?? "empty",
      workout,
    });
  }

  return cells;
}

const fadedLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.25)",
};

export function getDateLabelStyle(cell: CalendarCell): CSSProperties | undefined {
  if (cell.status === "done") return { color: "#86efac" };
  if (cell.status === "off_target") return { color: "#fbbf24" };
  if (cell.status === "today") return { color: "#93c5fd" };
  if (cell.status === "missed") return { color: "#fca5a5" };
  if (!cell.inCurrentMonth) return fadedLabelStyle;
  return undefined;
}

export function getDayCellStyle(cell: CalendarCell): CSSProperties {
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

  if (cell.status === "done") {
    base.background = "linear-gradient(180deg, rgba(16,185,129,0.16), rgba(255,255,255,0.035))";
    base.border = "1px solid rgba(16,185,129,0.28)";
    base.boxShadow = "0 0 0 1px rgba(16,185,129,0.08) inset";
    return base;
  }

  if (cell.status === "off_target") {
    base.background = "linear-gradient(180deg, rgba(245,158,11,0.16), rgba(255,255,255,0.035))";
    base.border = "1px solid rgba(245,158,11,0.32)";
    base.boxShadow = "0 0 0 1px rgba(245,158,11,0.08) inset";
    return base;
  }

  if (cell.status === "today") {
    base.background = "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(255,255,255,0.035))";
    base.border = "1px solid rgba(59,130,246,0.28)";
    base.boxShadow = "0 0 0 1px rgba(59,130,246,0.08) inset";
    return base;
  }

  if (cell.status === "missed") {
    base.background = "linear-gradient(180deg, rgba(239,68,68,0.12), rgba(255,255,255,0.03))";
    base.border = "1px solid rgba(239,68,68,0.24)";
    base.boxShadow = "0 0 0 1px rgba(239,68,68,0.06) inset";
  }

  return base;
}

export function getMobileDayCellStyle(cell: CalendarCell): CSSProperties {
  const base = getDayCellStyle(cell);
  return {
    ...base,
    minHeight: "auto",
    padding: "1rem",
  };
}

export const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".8rem 1rem",
  outline: "none",
  fontSize: 13,
};

export const selectStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".65rem .9rem",
  outline: "none",
  fontSize: 13,
  minWidth: 180,
};

export function navButtonStyle(disabled: boolean): CSSProperties {
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

export const weekdayHeaderGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
  marginTop: "1rem",
  marginBottom: ".6rem",
};

export const weekdayHeaderStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 800,
  textAlign: "center",
};

export const calendarGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
};

export const deleteButtonStyle: CSSProperties = {
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

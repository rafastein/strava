export type WeekEntry = {
  label: string;
  planned: number;
  actual: number;
  plannedSegments?: {
    dayLabel: string;
    distance: number;
  }[];
};

export type DecoratedWeekEntry = WeekEntry & {
  plannedSegments: { dayLabel: string; distance: number }[];
  adherence: number;
  isCurrent: boolean;
  statusClass: string;
  message: string;
  chartLabel: string[];
};

export const DAY_ORDER = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const PLANNED_SEGMENT_COLORS = [
  "rgba(148,163,184,0.18)",
  "rgba(148,163,184,0.24)",
  "rgba(148,163,184,0.30)",
  "rgba(148,163,184,0.36)",
  "rgba(148,163,184,0.42)",
  "rgba(148,163,184,0.48)",
  "rgba(148,163,184,0.54)",
];

export function getChartLabelParts(label: string) {
  const normalized = label.replace(/[–—]/g, "-");
  const [startRaw, endRaw] = normalized.split("-").map((part) => part.trim());

  if (!startRaw || !endRaw) return [label];

  return [startRaw, endRaw];
}

export function getOrderedWeekdays(weeks: WeekEntry[]) {
  const set = new Set<string>();
  weeks.forEach((week) => {
    week.plannedSegments?.forEach((segment) => {
      if (segment.distance > 0) set.add(segment.dayLabel);
    });
  });

  return DAY_ORDER.filter((day) => set.has(day));
}

export function sortWeekSegments(segments?: { dayLabel: string; distance: number }[]) {
  if (!segments?.length) return [];

  return [...segments].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayLabel) - DAY_ORDER.indexOf(b.dayLabel),
  );
}

export function getAdherence(week: WeekEntry) {
  if (week.planned <= 0) return 0;
  return (week.actual / week.planned) * 100;
}

export function getWeekStatusClass(week: WeekEntry) {
  const adherence = getAdherence(week);

  if (week.planned <= 0) return "weekly-card--muted";
  if (adherence >= 90) return "weekly-card--success";
  if (adherence >= 70) return "weekly-card--warning";
  return "weekly-card--danger";
}

export function getWeekMessage(week: WeekEntry) {
  if (week.planned <= 0) return "Sem volume planejado para esta semana.";

  const diff = week.actual - week.planned;

  if (diff >= 0) {
    return `Meta semanal cumprida. Excedente de ${diff.toFixed(1)} km.`;
  }

  return `Faltam ${Math.abs(diff).toFixed(1)} km para cumprir o planejado da semana.`;
}

function parseBrDatePart(value: string, fallbackYear: number) {
  const [day, month, year] = value.trim().split("/").map(Number);

  if (!day || !month) return null;

  return new Date(year || fallbackYear, month - 1, day, 12, 0, 0, 0);
}

export function isCurrentWeekLabel(label: string) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const normalized = label.replace(/\s/g, "").replace(/[–—]/g, "-");
  const [startRaw, endRaw] = normalized.split("-");

  if (!startRaw || !endRaw) return false;

  const start = parseBrDatePart(startRaw, currentYear);
  const end = parseBrDatePart(endRaw, currentYear);

  if (!start || !end) return false;

  if (end.getTime() < start.getTime()) {
    end.setFullYear(end.getFullYear() + 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return now >= start && now <= end;
}

export function decorateWeeks(weeks: WeekEntry[]): DecoratedWeekEntry[] {
  return weeks.map((week, index) => ({
    ...week,
    plannedSegments: sortWeekSegments(week.plannedSegments),
    adherence: getAdherence(week),
    isCurrent: index === 0 || isCurrentWeekLabel(week.label),
    statusClass: getWeekStatusClass(week),
    message: getWeekMessage(week),
    chartLabel: getChartLabelParts(week.label),
  }));
}

export function getWeeklyPlanSummary(weeks: WeekEntry[]) {
  const totalPlanned = weeks.reduce((sum, week) => sum + week.planned, 0);
  const totalActual = weeks.reduce((sum, week) => sum + week.actual, 0);
  const validWeeks = weeks.filter((week) => week.planned > 0);
  const weeksOnTarget = validWeeks.filter((week) => week.actual / week.planned >= 0.9).length;
  const bestWeekKm = weeks.length ? Math.max(...weeks.map((week) => week.actual)) : 0;
  const averageWeekKm = weeks.length ? totalActual / weeks.length : 0;

  return {
    totalPlanned,
    totalActual,
    validWeeks,
    weeksOnTarget,
    bestWeekKm,
    averageWeekKm,
  };
}

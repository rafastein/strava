// Semanas de segunda a domingo para o comparativo planejado × executado.

export type WeeklyPlannedSegment = {
  date: string;
  dayLabel: string;
  distanceKm: number;
};

export type WeeklyComparisonItem = {
  key: string;
  label: string;
  plannedKm: number;
  executedKm: number;
  adherencePct: number | null;
  plannedSegments?: WeeklyPlannedSegment[];
};

export function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
}

export function getWeekEnd(date: Date) {
  const d = new Date(getWeekStart(date));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);

  return d;
}

export function formatWeekLabel(date: Date) {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
  return `${start.toLocaleDateString("pt-BR", options)}–${end.toLocaleDateString("pt-BR", options)}`;
}

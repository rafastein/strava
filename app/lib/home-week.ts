import { isRunActivity } from "./strava-activity";

// Tudo aqui trabalha com chaves YYYY-MM-DD no horário local da atividade,
// sem Date local do servidor: o resultado é o mesmo em qualquer fuso.

type WeekActivity = {
  type?: string | null;
  sport_type?: string | null;
  distance: number;
  start_date_local?: string | null;
};

export type WeekDay = {
  dateKey: string;
  /** seg, ter, qua, qui, sex, sáb, dom */
  weekday: string;
  km: number;
  runs: number;
  isToday: boolean;
  isRaceDay: boolean;
};

export type RacePrKey = "km5" | "km10" | "half" | "marathon";

const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const DAY_MS = 86_400_000;

function keyToUtc(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function utcToKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Dias inteiros de `fromKey` até `toKey` (negativo se já passou). */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number | null {
  const from = keyToUtc(fromKey);
  const to = keyToUtc(toKey);
  if (from === null || to === null) return null;
  return Math.round((to - from) / DAY_MS);
}

/** Segunda a domingo da semana que contém `todayKey`. */
export function getWeekDateKeys(todayKey: string): string[] {
  const today = keyToUtc(todayKey);
  if (today === null) return [];
  const weekdayFromMonday = (new Date(today).getUTCDay() + 6) % 7;
  const monday = today - weekdayFromMonday * DAY_MS;
  return Array.from({ length: 7 }, (_, index) => utcToKey(monday + index * DAY_MS));
}

export function buildWeekDays(
  activities: WeekActivity[],
  todayKey: string,
  raceDateKeys: string[] = [],
): WeekDay[] {
  const raceDays = new Set(raceDateKeys);
  const totals = new Map<string, { km: number; runs: number }>();

  for (const activity of activities) {
    if (!isRunActivity(activity)) continue;
    const dateKey = activity.start_date_local?.slice(0, 10);
    if (!dateKey) continue;
    const current = totals.get(dateKey) ?? { km: 0, runs: 0 };
    current.km += activity.distance / 1000;
    current.runs += 1;
    totals.set(dateKey, current);
  }

  return getWeekDateKeys(todayKey).map((dateKey, index) => ({
    dateKey,
    weekday: WEEKDAY_LABELS[index],
    km: totals.get(dateKey)?.km ?? 0,
    runs: totals.get(dateKey)?.runs ?? 0,
    isToday: dateKey === todayKey,
    isRaceDay: raceDays.has(dateKey),
  }));
}

/** Qual recorde pessoal corresponde à distância da prova (mesmas faixas de strava-prs). */
export function getPrKeyForRaceDistance(distanceKm: number): RacePrKey | null {
  if (distanceKm >= 4.8 && distanceKm <= 5.3) return "km5";
  if (distanceKm >= 9.7 && distanceKm <= 10.4) return "km10";
  if (distanceKm >= 20.5 && distanceKm <= 21.8) return "half";
  if (distanceKm >= 41.5 && distanceKm <= 43) return "marathon";
  return null;
}

/** "é hoje", "amanhã", "em 12 dias" */
export function formatCountdown(days: number): { value: string; unit: string } {
  if (days <= 0) return { value: "Hoje", unit: "" };
  if (days === 1) return { value: "1", unit: "dia" };
  return { value: String(days), unit: "dias" };
}

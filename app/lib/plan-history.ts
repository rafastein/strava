import { buildWeekDays, daysBetweenDateKeys, getWeekDateKeys, type WeekDay } from "./home-week";
import {
  getStructuredWorkoutPlannedDistanceKm,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkoutRangeResult,
} from "./planned-workout";

// Planejado × feito semana a semana, com chaves YYYY-MM-DD (sem Date local do servidor).

type HistoryActivity = Parameters<typeof buildWeekDays>[0][number];

type SisrunPlanRow = { date: string; plannedDistanceKm: number };

export type PlanSource = "COROS" | "SisRUN";

export type PlanWeek = {
  /** Segunda-feira da semana. */
  weekStartKey: string;
  days: WeekDay[];
  plannedKm: number;
  km: number;
  runs: number;
  /** Feito ÷ planejado em %, sem teto; null quando a semana não tem plano. */
  adherencePct: number | null;
  source: PlanSource | null;
  isCurrent: boolean;
};

export type PlanHistorySummary = {
  /** Semanas encerradas que tinham plano. */
  weeks: number;
  plannedKm: number;
  km: number;
  adherencePct: number | null;
};

function addKm(map: Map<string, number>, dateKey: string, km: number) {
  map.set(dateKey, (map.get(dateKey) ?? 0) + km);
}

/** Km planejados por dia no COROS (só corrida; a data confiável é a da chave no Redis). */
export function getCorosPlannedKmByDate(workouts: StructuredPlannedWorkoutRangeResult[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const result of workouts) {
    if (!result.data || !isStructuredRunningWorkout(result.data)) continue;
    const km = getStructuredWorkoutPlannedDistanceKm(result.data);
    if (typeof km === "number" && Number.isFinite(km) && km > 0 && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
      addKm(byDate, result.date, km);
    }
  }
  return byDate;
}

/** Km planejados por dia na planilha do SisRUN (datas dd/mm/aaaa; ignora a linha "Resumo"). */
export function getSisrunPlannedKmByDate(rows: SisrunPlanRow[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date);
    if (!match || !(row.plannedDistanceKm > 0)) continue;
    addKm(byDate, `${match[3]}-${match[2]}-${match[1]}`, row.plannedDistanceKm);
  }
  return byDate;
}

/** Segunda-feira de `weeksBack` semanas antes da semana de `todayKey`. */
export function getHistoryStartKey(todayKey: string, weeksBack: number): string | null {
  const monday = getWeekDateKeys(todayKey)[0];
  if (!monday) return null;
  const time = Date.UTC(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, Number(monday.slice(8, 10)));
  return new Date(time - weeksBack * 7 * 86_400_000).toISOString().slice(0, 10);
}

function sumKm(map: Map<string, number>, keys: string[]) {
  return keys.reduce((sum, key) => sum + (map.get(key) ?? 0), 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Semana atual e as `weeks - 1` anteriores, da mais recente para a mais antiga.
 * Cada semana usa uma fonte só: COROS quando tem treino cadastrado nela, senão SisRUN.
 */
export function buildPlanHistory({
  activities,
  corosByDate,
  sisrunByDate,
  todayKey,
  weeks = 12,
}: {
  activities: HistoryActivity[];
  corosByDate: Map<string, number>;
  sisrunByDate: Map<string, number>;
  todayKey: string;
  weeks?: number;
}): PlanWeek[] {
  const result: PlanWeek[] = [];

  for (let back = 0; back < weeks; back += 1) {
    const anchor = getHistoryStartKey(todayKey, back);
    if (!anchor) break;
    const keys = getWeekDateKeys(anchor);

    const corosKm = sumKm(corosByDate, keys);
    const sisrunKm = sumKm(sisrunByDate, keys);
    const source: PlanSource | null = corosKm > 0 ? "COROS" : sisrunKm > 0 ? "SisRUN" : null;
    const plan = source === "COROS" ? corosByDate : source === "SisRUN" ? sisrunByDate : new Map<string, number>();

    const days = buildWeekDays(activities, anchor, [], plan).map((day) => ({ ...day, isToday: day.dateKey === todayKey }));
    const plannedKm = round1(days.reduce((sum, day) => sum + day.plannedKm, 0));
    const km = round1(days.reduce((sum, day) => sum + day.km, 0));

    result.push({
      weekStartKey: keys[0],
      days,
      plannedKm,
      km,
      runs: days.reduce((sum, day) => sum + day.runs, 0),
      adherencePct: plannedKm > 0 ? Math.round((km / plannedKm) * 100) : null,
      source,
      isCurrent: back === 0,
    });
  }

  return result;
}

/** Soma das semanas encerradas com plano (a semana em andamento distorceria a média). */
export function summarizePlanHistory(history: PlanWeek[]): PlanHistorySummary {
  const closed = history.filter((week) => !week.isCurrent && week.plannedKm > 0);
  const plannedKm = round1(closed.reduce((sum, week) => sum + week.plannedKm, 0));
  const km = round1(closed.reduce((sum, week) => sum + week.km, 0));
  return {
    weeks: closed.length,
    plannedKm,
    km,
    adherencePct: plannedKm > 0 ? Math.round((km / plannedKm) * 100) : null,
  };
}

/**
 * Planejado até agora na semana em andamento, para a aderência não parecer baixa no meio da semana:
 * dias passados contam sempre; hoje só conta depois que já tem corrida.
 */
export function getPlannedKmUntil(week: PlanWeek, todayKey: string): number {
  return round1(
    week.days
      .filter((day) => {
        const diff = daysBetweenDateKeys(day.dateKey, todayKey);
        return diff !== null && (diff > 0 || (diff === 0 && day.km > 0));
      })
      .reduce((sum, day) => sum + day.plannedKm, 0),
  );
}

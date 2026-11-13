import { getPrKeyForRaceDistance, type RacePrKey } from "./home-week";
import { getYearFromDateKey } from "./season";

// Resultado de cada prova da temporada: casa a prova cadastrada com a corrida do Strava
// do mesmo dia. Regras herdadas do antigo SeasonCalendar, agora puras e testáveis.

type ResultRace = {
  id: string;
  name: string;
  dateKey: string;
  location: string;
  distanceKm: number;
  featured: boolean;
  badge?: string;
};

type ResultActivity = {
  id: number;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  start_date_local?: string | null;
};

type ResultPrs = Record<RacePrKey, { activityId: number } | null>;

export type SeasonResult = {
  id: string;
  name: string;
  dateKey: string;
  location: string;
  distanceKm: number;
  badge?: string;
  /** Tempo oficial aproximado (decorrido) da corrida encontrada no Strava; null se não houver. */
  timeSec: number | null;
  activityId: number | null;
  isPR: boolean;
};

/** Anos com prova cadastrada até a temporada atual, do mais recente para o mais antigo. */
export function getResultSeasons(races: { dateKey: string }[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const race of races) {
    const year = getYearFromDateKey(race.dateKey);
    if (year !== null && year <= currentYear) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

export function resolveSeasonResults(
  races: ResultRace[],
  activities: ResultActivity[],
  prs: ResultPrs | null,
  todayKey: string,
  seasonYear: number,
): SeasonResult[] {
  const results: SeasonResult[] = [];

  for (const race of races) {
    if (getYearFromDateKey(race.dateKey) !== seasonYear) continue;
    // Provas futuras ficam na lista de próximas; a de hoje só entra depois de sincronizada.
    if (race.dateKey > todayKey) continue;

    const match =
      activities.find((activity) => {
        if (activity.type !== "Run") return false;
        if (activity.start_date_local?.slice(0, 10) !== race.dateKey) return false;
        const km = activity.distance / 1000;
        return km >= race.distanceKm * 0.9 && km <= race.distanceKm * 1.1;
      }) ?? null;

    if (!match && race.dateKey === todayKey) continue;

    const prKey = getPrKeyForRaceDistance(race.distanceKm);
    const isPR = Boolean(match && prKey && prs?.[prKey]?.activityId === match.id);

    // Provas não destacadas só aparecem quando viraram recorde.
    if (!race.featured && !isPR) continue;

    results.push({
      id: race.id,
      name: race.name,
      dateKey: race.dateKey,
      location: race.location,
      distanceKm: race.distanceKm,
      badge: race.badge,
      timeSec: match ? (match.elapsed_time && match.elapsed_time > 0 ? match.elapsed_time : match.moving_time) : null,
      activityId: match?.id ?? null,
      isPR,
    });
  }

  return results.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

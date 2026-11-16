import { getPrKeyForRaceDistance, type RacePrKey } from "./home-week";
import { getYearFromDateKey } from "./season";
import { isRunActivity } from "./strava-activity";

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
  name?: string | null;
  type: string;
  sport_type?: string | null;
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

const RACE_PREFIX = /prova:\s*/i;

/** Corrida marcada como prova no Strava ("Prova: Meia de Curitiba"). */
export function isTaggedRaceActivity(activity: { name?: string | null }): boolean {
  return RACE_PREFIX.test(activity.name ?? "");
}

/** Nome sem o marcador "Prova:". */
export function cleanRaceActivityName(name: string): string {
  return name.replace(RACE_PREFIX, "").replace(/\s{2,}/g, " ").trim();
}

function getResultTime(activity: ResultActivity) {
  return activity.elapsed_time && activity.elapsed_time > 0 ? activity.elapsed_time : activity.moving_time;
}

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
  const usedActivityIds = new Set<number>();

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

    // Provas não destacadas só aparecem quando viraram recorde ou quando a corrida está marcada "Prova:".
    if (!race.featured && !isPR && !(match && isTaggedRaceActivity(match))) continue;
    if (match) usedActivityIds.add(match.id);

    results.push({
      id: race.id,
      name: race.name,
      dateKey: race.dateKey,
      location: race.location,
      distanceKm: race.distanceKm,
      badge: race.badge,
      timeSec: match ? getResultTime(match) : null,
      activityId: match?.id ?? null,
      isPR,
    });
  }

  // Corridas marcadas "Prova:" no Strava que não casaram com nenhuma prova cadastrada.
  for (const activity of activities) {
    if (usedActivityIds.has(activity.id) || !isRunActivity(activity) || !isTaggedRaceActivity(activity)) continue;
    const dateKey = activity.start_date_local?.slice(0, 10);
    if (!dateKey || getYearFromDateKey(dateKey) !== seasonYear || dateKey > todayKey) continue;

    const distanceKm = Math.round(activity.distance / 100) / 10;
    const prKey = getPrKeyForRaceDistance(distanceKm);
    usedActivityIds.add(activity.id);
    results.push({
      id: `strava-${activity.id}`,
      name: cleanRaceActivityName(activity.name ?? "") || "Prova",
      dateKey,
      location: "",
      distanceKm,
      timeSec: getResultTime(activity),
      activityId: activity.id,
      isPR: Boolean(prKey && prs?.[prKey]?.activityId === activity.id),
    });
  }

  return results.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

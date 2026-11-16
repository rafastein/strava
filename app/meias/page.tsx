// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Navbar from "../components/Navbar";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import {
  getStravaActivities,
  getStravaActivityDetail,
  getStravaActivityLaps,
  getStravaAthlete,
  isRunActivity,
  STRAVA_2024_START_EPOCH,
  type StravaActivitySummary,
  type StravaLap,
  type StravaSplit,
} from "../lib/strava-client";
import { KNOWN_GEAR_NAME_FALLBACKS } from "../lib/equipment-recommendation";
import HalfMarathonComparison from "../components/HalfMarathonComparison";
import type { HalfMarathonEntry } from "../components/HalfMarathonComparison";
import { formatDuration } from "../lib/format";
import { getBestHalfIndex, getHalfRacePace } from "../lib/half-marathon";
import { getCurrentSeasonYear, getYearFromDateKey } from "../lib/season";

type StravaActivity = StravaActivitySummary;
type HalfSplitSource = "splits_metric" | "laps" | "estimated";
type HalfSplitsResult = {
  splits: HalfMarathonEntry["splits"];
  source: HalfSplitSource;
};
type StravaActivityDetailWithSplits = StravaActivitySummary & {
  splits_metric?: StravaSplit[] | null;
  laps?: StravaLap[] | null;
};

const HALF_MARATHON_MIN_M = 20_000;
const HALF_MARATHON_MAX_M = 22_500;
const OFFICIAL_RACE_NAME_TOKEN = "prova";

async function getActivities(token: string): Promise<StravaActivity[]> {
  return getStravaActivities({
    accessToken: token,
    after: STRAVA_2024_START_EPOCH,
    maxPages: 10,
  });
}

function toComparisonSplit(split: StravaSplit): HalfMarathonEntry["splits"][number] | null {
  const distanceM = split.distance ?? 0;
  const movingTimeSec = split.moving_time ?? 0;
  const paceSecPerKm = distanceM > 0 && movingTimeSec > 0 ? (movingTimeSec / distanceM) * 1000 : 0;

  if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return null;

  return {
    km: split.split,
    paceSecPerKm: Math.round(paceSecPerKm),
    heartrate: split.average_heartrate ? Math.round(split.average_heartrate) : null,
    distanceM: Math.round(distanceM),
  };
}

function convertMetricSplits(rawSplits: StravaSplit[] | null | undefined): HalfMarathonEntry["splits"] {
  if (!Array.isArray(rawSplits)) return [];

  return rawSplits
    .map(toComparisonSplit)
    .filter((split): split is HalfMarathonEntry["splits"][number] => Boolean(split));
}

function convertLaps(laps: StravaLap[] | null | undefined): HalfMarathonEntry["splits"] {
  if (!Array.isArray(laps)) return [];

  const splits: HalfMarathonEntry["splits"] = [];

  laps.forEach((lap, index) => {
    const distanceM = lap.distance ?? 0;
    const movingTimeSec = lap.moving_time ?? 0;
    const paceSecPerKm = distanceM > 0 && movingTimeSec > 0 ? (movingTimeSec / distanceM) * 1000 : 0;

    if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return;

    const roundedDistanceM = Math.round(distanceM);

    // Evita voltas manuais muito curtas/longas entrando como se fossem splits de km.
    if (roundedDistanceM < 750 || roundedDistanceM > 1_500) return;

    splits.push({
      km: lap.split ?? index + 1,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: lap.average_heartrate ? Math.round(lap.average_heartrate) : null,
      distanceM: roundedDistanceM,
    });
  });

  return splits;
}

function buildEstimatedSplits(activity: StravaActivity): HalfMarathonEntry["splits"] {
  const totalDistanceM = activity.distance ?? 0;
  const totalMovingTimeSec = activity.moving_time ?? 0;
  const paceSecPerKm = totalDistanceM > 0 && totalMovingTimeSec > 0
    ? (totalMovingTimeSec / totalDistanceM) * 1000
    : 0;

  if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return [];

  const fullKilometers = Math.floor(totalDistanceM / 1000);
  const remainderM = Math.round(totalDistanceM - fullKilometers * 1000);
  const splits: HalfMarathonEntry["splits"] = [];

  for (let km = 1; km <= fullKilometers; km += 1) {
    splits.push({
      km,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      distanceM: 1000,
    });
  }

  if (remainderM >= 300) {
    splits.push({
      km: fullKilometers + 1,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      distanceM: remainderM,
    });
  }

  return splits;
}

async function getActivitySplits(
  activity: StravaActivity,
  token: string,
): Promise<HalfSplitsResult> {
  const detail = await getStravaActivityDetail(
    activity.id,
    token,
  ) as StravaActivityDetailWithSplits | null;

  const metricSplits = convertMetricSplits(detail?.splits_metric);
  if (metricSplits.length > 0) return { splits: metricSplits, source: "splits_metric" };

  const detailLaps = convertLaps(detail?.laps);
  if (detailLaps.length > 0) return { splits: detailLaps, source: "laps" };

  const apiLaps = convertLaps(await getStravaActivityLaps(activity.id, token));
  if (apiLaps.length > 0) return { splits: apiLaps, source: "laps" };

  return { splits: buildEstimatedSplits(activity), source: "estimated" };
}

function cleanRaceName(name: string): string {
  return name
    .replace(/^\s*prova:\s*/i, "")
    .replace(/\s*\*{2,}\s*$/g, "")
    .trim();
}

function buildGearNameLookup(athleteGear: { id: string; name: string }[] = []): Record<string, string> {
  const lookup: Record<string, string> = { ...KNOWN_GEAR_NAME_FALLBACKS };

  athleteGear.forEach((gear) => {
    lookup[gear.id] = KNOWN_GEAR_NAME_FALLBACKS[gear.id] ?? gear.name;
  });

  return lookup;
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isHalfMarathonRaceCandidate(activity: StravaActivity): boolean {
  const isHalfDistance = activity.distance >= HALF_MARATHON_MIN_M && activity.distance <= HALF_MARATHON_MAX_M;
  const hasRaceName = normalizeText(activity.name ?? "").includes(OFFICIAL_RACE_NAME_TOKEN);

  return isRunActivity(activity) && isHalfDistance && hasRaceName;
}

export default async function MeiasPage() {
  const token = await getValidStravaAccessToken();
  const [activities, athlete] = token
    ? await Promise.all([getActivities(token), getStravaAthlete(token)])
    : [[], null] as const;
  const gearNameLookup = buildGearNameLookup(Array.isArray(athlete?.shoes) ? athlete.shoes : []);

  const halvesBase = activities
    .filter(isHalfMarathonRaceCandidate)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const halves: HalfMarathonEntry[] = [];

  if (token) {
    for (const activity of halvesBase) {
      const result = await getActivitySplits(activity, token);
      if (result.splits.length === 0) continue;

      halves.push({
        id: activity.id,
        name: cleanRaceName(activity.name),
        date: activity.start_date_local,
        distanceKm: Number((activity.distance / 1000).toFixed(2)),
        gearName: activity.gear_id ? gearNameLookup[activity.gear_id] ?? activity.gear_id : null,
        timeSec: activity.elapsed_time > 0 ? activity.elapsed_time : activity.moving_time,
        splits: result.splits,
        splitSource: result.source,
      });
    }
  }

  const estimatedCount = halves.filter((half) => half.splitSource === "estimated").length;

  const bestIdx = getBestHalfIndex(halves);
  const best = bestIdx >= 0 ? halves[bestIdx] : null;
  // Pace da mais antiga contra a mais recente; positivo = mais rápido hoje.
  const oldestPace = halves.length >= 2 ? getHalfRacePace(halves[halves.length - 1]) : 0;
  const latestPace = halves.length >= 2 ? getHalfRacePace(halves[0]) : 0;
  const evolutionSec = oldestPace > 0 && latestPace > 0 ? Math.round(oldestPace - latestPace) : null;
  const firstYear = halves.length ? getYearFromDateKey(halves[halves.length - 1].date) : null;

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Meias maratonas</h1>
            <p className="ui-muted">
              {halves.length} {halves.length === 1 ? "prova" : "provas"}{firstYear ? ` desde ${firstYear}` : ""}, comparadas km a km
            </p>
          </div>
        </header>

        {halves.length === 0 ? (
          <p className="ui-card ui-card--pad ui-muted">
            {!token
              ? "Não consegui autenticar no Strava. Confira STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET e STRAVA_REFRESH_TOKEN na Vercel."
              : halvesBase.length > 0
                ? `Encontrei ${halvesBase.length} meia(s), mas o Strava não devolveu splits para montar o gráfico.`
                : "Nenhuma atividade com “Prova” no nome e distância de meia maratona foi encontrada desde 2024."}
          </p>
        ) : (
          <div className="hoje-col">
            <div className="ui-stat-grid">
              <div className="ui-stat">
                <span className="ui-stat__value">{best?.timeSec ? formatDuration(best.timeSec) : "—"}</span>
                <span className="ui-stat__label">{best ? `melhor · ${best.name}` : "melhor"}</span>
              </div>
              <div className="ui-stat">
                <span className="ui-stat__value">{halves[0]?.timeSec ? formatDuration(halves[0].timeSec) : "—"}</span>
                <span className="ui-stat__label">mais recente · {halves[0]?.name}</span>
              </div>
              <div className="ui-stat">
                <span className="ui-stat__value">
                  {evolutionSec === null ? "—" : evolutionSec === 0 ? "igual" : `${evolutionSec > 0 ? "−" : "+"}${Math.abs(evolutionSec)} s/km`}
                </span>
                <span className="ui-stat__label">pace da última contra a primeira</span>
              </div>
            </div>

            {estimatedCount > 0 ? (
              <p className="ui-muted" style={{ padding: "0 4px" }}>
                {estimatedCount} {estimatedCount === 1 ? "prova aparece" : "provas aparecem"} com linha reta pelo pace médio: o Strava não devolveu splits.
              </p>
            ) : null}

            <HalfMarathonComparison races={halves} />
          </div>
        )}
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

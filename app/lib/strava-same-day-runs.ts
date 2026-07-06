import { getActivityDate, getBRDateKey } from "./date-utils";
import { isRunActivity, type StravaActivitySummary } from "./strava-client";

export type SameDayRunActivity = Omit<StravaActivitySummary, "id"> & {
  id: number | string;
  name: string;
  sourceActivityIds?: Array<number | string>;
  mergedActivityCount?: number;
  isMergedSameDayRun?: boolean;
};

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function pickDate(activity: StravaActivitySummary) {
  return activity.start_date_local ?? activity.start_date ?? "";
}

function weightedAverage(
  values: Array<{ value?: number | null; weight: number }>,
) {
  const valid = values.filter(
    (item): item is { value: number; weight: number } =>
      typeof item.value === "number" && Number.isFinite(item.value) && item.weight > 0,
  );

  if (valid.length === 0) return null;

  const weightSum = valid.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum <= 0) return null;

  return valid.reduce((sum, item) => sum + item.value * item.weight, 0) / weightSum;
}

function buildMergedName(dateKey: string, activities: StravaActivitySummary[]) {
  const namedLongRun = activities.find((activity) => /long[aã]o/i.test(activity.name ?? ""));
  if (namedLongRun?.name) return `${namedLongRun.name} · consolidado (${activities.length} partes)`;

  const totalKm = activities.reduce((sum, activity) => sum + safeNumber(activity.distance) / 1000, 0);
  return `Corridas do dia · ${dateKey} · consolidado (${activities.length} partes · ${totalKm.toFixed(1)} km)`;
}

export function combineSameDayRuns(activities: StravaActivitySummary[]): SameDayRunActivity[] {
  const groups = new Map<string, StravaActivitySummary[]>();
  const nonRuns: SameDayRunActivity[] = [];

  activities.forEach((activity) => {
    if (!isRunActivity(activity)) {
      nonRuns.push(activity);
      return;
    }

    const dateKey = getBRDateKey(pickDate(activity));
    if (!dateKey) {
      nonRuns.push(activity);
      return;
    }

    const current = groups.get(dateKey) ?? [];
    current.push(activity);
    groups.set(dateKey, current);
  });

  const mergedRuns = Array.from(groups.entries()).map(([dateKey, group]) => {
    const ordered = [...group].sort(
      (a, b) => new Date(pickDate(a)).getTime() - new Date(pickDate(b)).getTime(),
    );

    if (ordered.length === 1) return ordered[0] as SameDayRunActivity;

    const longest = ordered.reduce((best, activity) =>
      safeNumber(activity.distance) > safeNumber(best.distance) ? activity : best,
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const movingTime = ordered.reduce((sum, activity) => sum + safeNumber(activity.moving_time), 0);
    const elapsedTime = ordered.reduce((sum, activity) => sum + safeNumber(activity.elapsed_time), 0);
    const distance = ordered.reduce((sum, activity) => sum + safeNumber(activity.distance), 0);
    const elevationGain = ordered.reduce((sum, activity) => sum + safeNumber(activity.total_elevation_gain), 0);
    const averageHr = weightedAverage(
      ordered.map((activity) => ({
        value: activity.average_heartrate,
        weight: safeNumber(activity.moving_time),
      })),
    );
    const maxHrValues = ordered
      .map((activity) => activity.max_heartrate)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      ...longest,
      id: `merged-${dateKey}`,
      name: buildMergedName(dateKey, ordered),
      distance,
      moving_time: movingTime,
      elapsed_time: elapsedTime || movingTime,
      total_elevation_gain: elevationGain,
      average_heartrate: averageHr,
      max_heartrate: maxHrValues.length ? Math.max(...maxHrValues) : null,
      start_date: first.start_date,
      start_date_local: first.start_date_local,
      end_latlng: last.end_latlng ?? longest.end_latlng,
      start_latlng: first.start_latlng ?? longest.start_latlng,
      location_city: longest.location_city,
      location_state: longest.location_state,
      gear_id: longest.gear_id,
      sourceActivityIds: ordered.map((activity) => activity.id),
      mergedActivityCount: ordered.length,
      isMergedSameDayRun: true,
    } satisfies SameDayRunActivity;
  });

  return [...nonRuns, ...mergedRuns].sort(
    (a, b) => new Date(getActivityDate(b)).getTime() - new Date(getActivityDate(a)).getTime(),
  );
}

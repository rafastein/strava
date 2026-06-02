import { getValidStravaAccessToken } from "./strava-auth";

export type StravaSplitMetric = {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_grade_adjusted_speed?: number | null;
  average_heartrate?: number | null;
  pace_zone?: number | null;
};

export type SplitEntry = {
  km: number;
  paceSecPerKm: number;
  paceMinPerKm: number;
  heartrate: number | null;
  elevationDiff: number;
  distanceM: number;
};

export type ActivitySplits = {
  activityId: number;
  splits: SplitEntry[];
};

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getActivitySplits(
  activityId: number
): Promise<ActivitySplits | null> {
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return null;

    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const raw: StravaSplitMetric[] = data?.splits_metric ?? [];

    if (!Array.isArray(raw) || raw.length === 0) return null;

    const splits: SplitEntry[] = raw.map((s) => {
      const distanceM = safeNumber(s.distance);
      const movingTimeSec = safeNumber(s.moving_time);
      const paceSecPerKm =
        distanceM > 0 && movingTimeSec > 0
          ? (movingTimeSec / distanceM) * 1000
          : 0;
      const paceMinPerKm = paceSecPerKm / 60;

      return {
        km: s.split,
        paceSecPerKm: Math.round(paceSecPerKm),
        paceMinPerKm: parseFloat(paceMinPerKm.toFixed(4)),
        heartrate:
          typeof s.average_heartrate === "number" &&
          Number.isFinite(s.average_heartrate)
            ? Math.round(s.average_heartrate)
            : null,
        elevationDiff: Math.round(safeNumber(s.elevation_difference)),
        distanceM: Math.round(distanceM),
      };
    });

    return { activityId, splits };
  } catch {
    return null;
  }
}

export function formatSplitPace(secPerKm: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "-";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

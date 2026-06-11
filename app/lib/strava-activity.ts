export const STRAVA_RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function isRunActivity(
  activity: { type?: string | null; sport_type?: string | null } | null | undefined,
) {
  if (!activity) return false;

  return (
    Boolean(activity.type && STRAVA_RUN_SPORT_TYPES.has(activity.type)) ||
    Boolean(activity.sport_type && STRAVA_RUN_SPORT_TYPES.has(activity.sport_type))
  );
}

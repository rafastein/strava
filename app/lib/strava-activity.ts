export const STRAVA_RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
export const STRAVA_EQUIPMENT_RUN_SPORT_TYPES = new Set(["Run", "TrailRun"]);

type StravaActivityKind = {
  type?: string | null;
  sport_type?: string | null;
};

export function isRunActivity(
  activity: StravaActivityKind | null | undefined,
) {
  if (!activity) return false;

  return (
    Boolean(activity.type && STRAVA_RUN_SPORT_TYPES.has(activity.type)) ||
    Boolean(activity.sport_type && STRAVA_RUN_SPORT_TYPES.has(activity.sport_type))
  );
}

/**
 * Filtro específico da página de equipamentos.
 *
 * O Strava normalmente envia `type: "Run"` também para uma corrida virtual,
 * diferenciando-a apenas por `sport_type: "VirtualRun"`. Por isso, quando
 * `sport_type` existe, ele precisa ter prioridade sobre o campo genérico
 * `type`; caso contrário, corridas virtuais entram como corridas comuns.
 */
export function isEquipmentRunActivity(
  activity: StravaActivityKind | null | undefined,
) {
  if (!activity) return false;

  const activityType = activity.sport_type ?? activity.type;
  return Boolean(
    activityType && STRAVA_EQUIPMENT_RUN_SPORT_TYPES.has(activityType),
  );
}

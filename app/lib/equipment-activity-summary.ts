import { isEquipmentRunActivity } from "./strava-activity";

export type EquipmentActivityLike = {
  type?: string | null;
  sport_type?: string | null;
  gear_id?: string | null;
  distance: number;
  moving_time: number;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  start_date: string;
  start_date_local?: string | null;
};

export type EquipmentActivityStats = {
  totalKm: number;
  totalTime: number;
  totalElevation: number;
  activities: number;
  heartRates: number[];
  efficiencies: number[];
  lastUse: string;
};

function createEmptyStats(): EquipmentActivityStats {
  return {
    totalKm: 0,
    totalTime: 0,
    totalElevation: 0,
    activities: 0,
    heartRates: [],
    efficiencies: [],
    lastUse: "",
  };
}

export function calculateEquipmentEfficiency(
  distanceKm: number,
  movingTimeSec: number,
  averageHeartrate: number | null | undefined,
  elevationGain: number,
) {
  if (!distanceKm || !movingTimeSec || !averageHeartrate) return null;

  const rawSpeedKmh = distanceKm / (movingTimeSec / 3600);
  const elevationFactor =
    elevationGain > 0 ? 1 + elevationGain / (distanceKm * 100) : 1;

  return ((rawSpeedKmh * elevationFactor) / averageHeartrate) * 1000;
}

/**
 * Agrupa apenas atividades de corrida comum e trail run por equipamento.
 *
 * A distância agregada de `athlete.shoes[].distance` não é usada aqui porque
 * o Strava não informa quais modalidades compõem aquele total. Usá-la junto
 * com tempo e quantidade calculados a partir de atividades filtradas mistura
 * bases diferentes e produz métricas incorretas.
 */
export function summarizeEquipmentActivities(
  activities: EquipmentActivityLike[],
): Map<string, EquipmentActivityStats> {
  const grouped = new Map<string, EquipmentActivityStats>();

  activities.forEach((activity) => {
    if (!isEquipmentRunActivity(activity) || !activity.gear_id) return;

    const item = grouped.get(activity.gear_id) ?? createEmptyStats();
    const distanceKm = activity.distance / 1000;
    const elevationGain = activity.total_elevation_gain ?? 0;

    item.totalKm += distanceKm;
    item.totalTime += activity.moving_time;
    item.totalElevation += elevationGain;
    item.activities += 1;

    if (activity.average_heartrate) {
      item.heartRates.push(activity.average_heartrate);
    }

    const efficiency = calculateEquipmentEfficiency(
      distanceKm,
      activity.moving_time,
      activity.average_heartrate,
      elevationGain,
    );

    if (efficiency) {
      item.efficiencies.push(efficiency);
    }

    const activityDate = activity.start_date_local ?? activity.start_date;
    if (!item.lastUse || new Date(activityDate) > new Date(item.lastUse)) {
      item.lastUse = activityDate;
    }

    grouped.set(activity.gear_id, item);
  });

  return grouped;
}

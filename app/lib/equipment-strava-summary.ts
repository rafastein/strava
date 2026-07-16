import { type StravaActivitySummary, type StravaGear } from "./strava-client";
import { isEquipmentRunActivity } from "./strava-activity";
import {
  KNOWN_GEAR_NAME_FALLBACKS,
  getShoeMaxKm,
  inferBrand,
  type GearForRecommendation,
} from "./equipment-recommendation";

export type GearRecommendationSummary = GearForRecommendation & {
  gearId: string;
  activities: number;
  lastUse: string;
};

export function buildGearRecommendationSummaries(
  activities: StravaActivitySummary[],
  athleteGear: StravaGear[],
): GearRecommendationSummary[] {
  const athleteGearById = new Map(athleteGear.map((gear) => [gear.id, gear]));
  const gearNameLookup: Record<string, string> = { ...KNOWN_GEAR_NAME_FALLBACKS };
  const stravaGearDistanceKm: Record<string, number> = {};

  athleteGear.forEach((gear) => {
    gearNameLookup[gear.id] = KNOWN_GEAR_NAME_FALLBACKS[gear.id] ?? gear.name;
    stravaGearDistanceKm[gear.id] = (gear.distance ?? 0) / 1000;
  });

  const allGearIds = new Set([
    ...Object.keys(KNOWN_GEAR_NAME_FALLBACKS),
    ...athleteGear.map((gear) => gear.id),
  ]);

  const grouped = new Map<string, GearRecommendationSummary>();

  allGearIds.forEach((gearId) => {
    const stravaGear = athleteGearById.get(gearId);
    const name = gearNameLookup[gearId] ?? stravaGear?.name ?? gearId;
    grouped.set(gearId, {
      gearId,
      name,
      brand: inferBrand(name, stravaGear?.brand_name),
      totalKm: 0,
      maxKm: getShoeMaxKm(name),
      activities: 0,
      lastUse: "",
    });
  });

  activities
    .filter((activity) => isEquipmentRunActivity(activity) && activity.gear_id && allGearIds.has(activity.gear_id))
    .forEach((activity) => {
      const gearId = activity.gear_id as string;
      const item = grouped.get(gearId);
      if (!item) return;

      item.totalKm += activity.distance / 1000;
      item.activities += 1;

      const activityDate = activity.start_date_local ?? activity.start_date;
      if (!item.lastUse || new Date(activityDate) > new Date(item.lastUse)) {
        item.lastUse = activityDate;
      }
    });

  grouped.forEach((gear) => {
    const stravaTotalKm = stravaGearDistanceKm[gear.gearId] ?? 0;
    gear.totalKm = Number(Math.max(gear.totalKm, stravaTotalKm).toFixed(1));
  });

  return Array.from(grouped.values())
    .filter((gear) => gear.activities > 0 || gear.totalKm > 0 || athleteGearById.has(gear.gearId))
    .sort((a, b) => b.totalKm - a.totalKm);
}

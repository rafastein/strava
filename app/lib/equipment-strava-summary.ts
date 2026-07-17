import { type StravaActivitySummary, type StravaGear } from "./strava-client";
import { summarizeEquipmentActivities } from "./equipment-activity-summary";
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

  athleteGear.forEach((gear) => {
    gearNameLookup[gear.id] = KNOWN_GEAR_NAME_FALLBACKS[gear.id] ?? gear.name;
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

  const activityStatsByGear = summarizeEquipmentActivities(activities);

  activityStatsByGear.forEach((stats, gearId) => {
    if (!allGearIds.has(gearId)) return;

    const item = grouped.get(gearId);
    if (!item) return;

    item.totalKm = stats.totalKm;
    item.activities = stats.activities;
    item.lastUse = stats.lastUse;
  });

  return Array.from(grouped.values())
    .filter((gear) => gear.activities > 0 || gear.totalKm > 0 || athleteGearById.has(gear.gearId))
    .sort((a, b) => b.totalKm - a.totalKm);
}

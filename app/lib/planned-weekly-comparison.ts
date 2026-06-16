import { isRunActivity } from "./strava-activity";
import { getBRDate } from "./date-utils";
import {
  getStructuredWorkoutPlannedDistanceKm,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkoutRangeResult,
} from "./planned-workout";
import { formatWeekLabel, getWeekStart, type WeeklyComparisonItem } from "./sisrun-utils";
import type { StravaActivitySummary } from "./strava-client";

function getDateFromIso(dateIso: string) {
  const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getActivityBrazilDate(activity: StravaActivitySummary) {
  return getBRDate(activity.start_date_local ?? activity.start_date ?? null);
}

function roundKm(value: number) {
  return Number(value.toFixed(1));
}

function getStructuredWorkoutDistanceKm(result: StructuredPlannedWorkoutRangeResult) {
  if (!result.data || !isStructuredRunningWorkout(result.data)) return 0;

  const distance = getStructuredWorkoutPlannedDistanceKm(result.data);
  return typeof distance === "number" && Number.isFinite(distance) ? distance : 0;
}

export function hasStructuredPlannedRunningWorkouts(workouts: StructuredPlannedWorkoutRangeResult[]) {
  return workouts.some((workout) => getStructuredWorkoutDistanceKm(workout) > 0);
}

export function getStructuredCurrentWeekSummary(
  workouts: StructuredPlannedWorkoutRangeResult[],
  referenceDate = new Date(),
) {
  const currentWeekKey = getWeekStart(referenceDate).toISOString();
  let plannedKm = 0;
  let longRunPlannedKm = 0;
  let workoutCount = 0;

  workouts.forEach((result) => {
    const workoutDate = getDateFromIso(result.date);
    if (!workoutDate) return;
    if (getWeekStart(workoutDate).toISOString() !== currentWeekKey) return;

    const distanceKm = getStructuredWorkoutDistanceKm(result);
    if (distanceKm <= 0) return;

    plannedKm += distanceKm;
    workoutCount += 1;
    longRunPlannedKm = Math.max(longRunPlannedKm, distanceKm);
  });

  return {
    plannedKm: roundKm(plannedKm),
    longRunPlannedKm: roundKm(longRunPlannedKm),
    workoutCount,
  };
}

export function buildStructuredWeeklyComparison(
  workouts: StructuredPlannedWorkoutRangeResult[],
  activities: StravaActivitySummary[],
  limit = 6,
  referenceDate = new Date(),
): WeeklyComparisonItem[] {
  const map = new Map<string, WeeklyComparisonItem>();
  const currentWeekStartTime = getWeekStart(referenceDate).getTime();

  workouts.forEach((result) => {
    const workoutDate = getDateFromIso(result.date);
    if (!workoutDate) return;

    const weekStart = getWeekStart(workoutDate);
    if (weekStart.getTime() > currentWeekStartTime) return;

    const plannedDistanceKm = getStructuredWorkoutDistanceKm(result);
    if (plannedDistanceKm <= 0) return;

    const key = weekStart.toISOString();
    const existing =
      map.get(key) ??
      {
        key,
        label: formatWeekLabel(weekStart),
        plannedKm: 0,
        executedKm: 0,
        adherencePct: null,
      };

    existing.plannedKm += plannedDistanceKm;
    map.set(key, existing);
  });

  activities.filter(isRunActivity).forEach((activity) => {
    const activityDate = getActivityBrazilDate(activity);
    if (!activityDate) return;

    const weekStart = getWeekStart(activityDate);
    if (weekStart.getTime() > currentWeekStartTime) return;

    const key = weekStart.toISOString();
    const existing =
      map.get(key) ??
      {
        key,
        label: formatWeekLabel(weekStart),
        plannedKm: 0,
        executedKm: 0,
        adherencePct: null,
      };

    existing.executedKm += activity.distance / 1000;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-limit)
    .map((item) => {
      const plannedKm = roundKm(item.plannedKm);
      const executedKm = roundKm(item.executedKm);

      return {
        ...item,
        plannedKm,
        executedKm,
        adherencePct: plannedKm > 0 ? Number(((executedKm / plannedKm) * 100).toFixed(1)) : null,
      };
    });
}

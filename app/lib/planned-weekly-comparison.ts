import { isRunActivity } from "./strava-activity";
import { getBRDate } from "./date-utils";
import {
  getStructuredWorkoutPlannedDistanceKm,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkoutRangeResult,
} from "./planned-workout";
import { formatWeekLabel, getWeekStart, type WeeklyComparisonItem, type WeeklyPlannedSegment } from "./sisrun-utils";

function getDateFromIso(dateIso: string) {
  const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getActivityBrazilDate(activity: ActivityForWeeklyComparison) {
  return getBRDate(activity.start_date_local ?? activity.start_date ?? null);
}

function roundKm(value: number) {
  return Number(value.toFixed(1));
}

function getBrazilCalendarDate(referenceDate = new Date()) {
  const dateKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);

  return getDateFromIso(dateKey) ?? referenceDate;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function weekTouchesMonth(weekStart: Date, monthReference: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return weekStart <= getMonthEnd(monthReference) && weekEnd >= getMonthStart(monthReference);
}

function getWeekStartsTouchingMonth(monthReference: Date) {
  const monthStart = getMonthStart(monthReference);
  const monthEnd = getMonthEnd(monthReference);
  const firstWeekStart = getWeekStart(monthStart);
  const weeks: Date[] = [];

  for (let cursor = new Date(firstWeekStart); cursor <= monthEnd; cursor.setDate(cursor.getDate() + 7)) {
    weeks.push(new Date(cursor));
  }

  return weeks;
}


type ActivityForWeeklyComparison = {
  id?: number | string;
  type?: string | null;
  sport_type?: string | null;
  distance: number;
  start_date?: string | null;
  start_date_local?: string | null;
};

type StructuredWeeklyComparisonOptions = {
  onlyWeeksTouchingReferenceMonth?: boolean;
};

function getStructuredWorkoutDistanceKm(result: StructuredPlannedWorkoutRangeResult) {
  if (!result.data || !isStructuredRunningWorkout(result.data)) return 0;

  const distance = getStructuredWorkoutPlannedDistanceKm(result.data);
  return typeof distance === "number" && Number.isFinite(distance) ? distance : 0;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_SORT_ORDER = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekdayShortLabel(date: Date) {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

function sortSegments(segments: WeeklyPlannedSegment[]) {
  return [...segments]
    .sort((a, b) => {
      const dayOrderA = WEEKDAY_SORT_ORDER.indexOf(a.dayLabel);
      const dayOrderB = WEEKDAY_SORT_ORDER.indexOf(b.dayLabel);

      if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;
      return a.date.localeCompare(b.date);
    })
    .map((segment) => ({
      ...segment,
      distanceKm: roundKm(segment.distanceKm),
    }));
}

export function hasStructuredPlannedRunningWorkouts(workouts: StructuredPlannedWorkoutRangeResult[]) {
  return workouts.some((workout) => getStructuredWorkoutDistanceKm(workout) > 0);
}

export function getStructuredCurrentWeekSummary(
  workouts: StructuredPlannedWorkoutRangeResult[],
  referenceDate = new Date(),
) {
  const brazilReferenceDate = getBrazilCalendarDate(referenceDate);
  const currentWeekKey = getWeekStart(brazilReferenceDate).toISOString();
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
  activities: ActivityForWeeklyComparison[],
  limit = 6,
  referenceDate = new Date(),
  options: StructuredWeeklyComparisonOptions = {},
): WeeklyComparisonItem[] {
  const map = new Map<string, WeeklyComparisonItem>();
  const brazilReferenceDate = getBrazilCalendarDate(referenceDate);
  const currentWeekStart = getWeekStart(brazilReferenceDate);
  const currentWeekStartTime = currentWeekStart.getTime();

  function shouldShowWeek(weekStart: Date) {
    if (options.onlyWeeksTouchingReferenceMonth) {
      return weekTouchesMonth(weekStart, brazilReferenceDate);
    }

    return weekStart.getTime() >= currentWeekStartTime;
  }

  if (options.onlyWeeksTouchingReferenceMonth) {
    getWeekStartsTouchingMonth(brazilReferenceDate).forEach((weekStart) => {
      const key = weekStart.toISOString();
      map.set(key, {
        key,
        label: formatWeekLabel(weekStart),
        plannedKm: 0,
        executedKm: 0,
        adherencePct: null,
        plannedSegments: [],
      });
    });
  }

  workouts.forEach((result) => {
    const workoutDate = getDateFromIso(result.date);
    if (!workoutDate) return;

    const weekStart = getWeekStart(workoutDate);
    if (!shouldShowWeek(weekStart)) return;

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
        plannedSegments: [],
      };

    existing.plannedKm += plannedDistanceKm;

    const segmentDate = result.date;
    const existingSegment = existing.plannedSegments?.find((segment) => segment.date === segmentDate);
    if (existingSegment) {
      existingSegment.distanceKm += plannedDistanceKm;
    } else {
      existing.plannedSegments = [
        ...(existing.plannedSegments ?? []),
        {
          date: segmentDate,
          dayLabel: getWeekdayShortLabel(workoutDate),
          distanceKm: plannedDistanceKm,
        },
      ];
    }

    map.set(key, existing);
  });

  activities.filter(isRunActivity).forEach((activity) => {
    const activityDate = getActivityBrazilDate(activity);
    if (!activityDate) return;

    const weekStart = getWeekStart(activityDate);
    if (!shouldShowWeek(weekStart)) return;

    const key = weekStart.toISOString();
    const existing =
      map.get(key) ??
      {
        key,
        label: formatWeekLabel(weekStart),
        plannedKm: 0,
        executedKm: 0,
        adherencePct: null,
        plannedSegments: [],
      };

    existing.executedKm += activity.distance / 1000;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, limit)
    .map((item) => {
      const plannedKm = roundKm(item.plannedKm);
      const executedKm = roundKm(item.executedKm);

      return {
        ...item,
        plannedKm,
        executedKm,
        adherencePct: plannedKm > 0 ? Number(((executedKm / plannedKm) * 100).toFixed(1)) : null,
        plannedSegments: sortSegments(item.plannedSegments ?? []),
      };
    });
}

import { getBRDateKey } from "./date-utils";
import { isRunActivity, type StravaActivitySummary } from "./strava-client";
import { BUENOS_AIRES_RACE_ISO, MARATHON_CYCLE_START_ISO } from "./race-calendar";

export const BUENOS_AIRES_DATE_KEY = BUENOS_AIRES_RACE_ISO.slice(0, 10);
export const BUENOS_AIRES_CYCLE_START_KEY = MARATHON_CYCLE_START_ISO.slice(0, 10);

// Strava's local timestamp is a wall-clock value, even when it ends in Z.
export function getActivityLocalDateKey(activity: {
  start_date_local?: string | null;
  start_date?: string | null;
}) {
  const localKey = activity.start_date_local?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (localKey) return localKey;
  if (!activity.start_date || !Number.isFinite(Date.parse(activity.start_date))) return "";
  return getBRDateKey(activity.start_date);
}

export function findBuenosAiresMarathon(activities: StravaActivitySummary[]) {
  return activities
    .filter((activity) =>
      isRunActivity(activity) &&
      activity.type !== "VirtualRun" && activity.sport_type !== "VirtualRun" &&
      getActivityLocalDateKey(activity) === BUENOS_AIRES_DATE_KEY &&
      activity.distance >= 40000 && activity.distance <= 45000,
    )
    .sort((a, b) => {
      const named = (activity: StravaActivitySummary) =>
        /buenos\s*aires/i.test(`${activity.name} ${activity.location_city ?? ""}`) ? 1 : 0;
      return named(b) - named(a) || Math.abs(a.distance - 42195) - Math.abs(b.distance - 42195);
    })[0] ?? null;
}

export function getRecordedRaceTime(activity: StravaActivitySummary | null) {
  // Moving time can omit stops. Never present it as elapsed race time.
  return activity && Number.isFinite(activity.elapsed_time) && activity.elapsed_time > 0
    ? activity.elapsed_time : null;
}

export function formatArchiveDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 3600)}:${String(Math.floor(rounded / 60) % 60).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

export function formatArchivePace(secondsPerKm: number | null) {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "—";
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/km`;
}

export function buildBuenosAiresArchive(activities: StravaActivitySummary[]) {
  const trainingRuns = activities.filter((activity) => {
    const key = getActivityLocalDateKey(activity);
    return isRunActivity(activity) && Number.isFinite(activity.distance) && activity.distance > 0 &&
      key >= BUENOS_AIRES_CYCLE_START_KEY && key < BUENOS_AIRES_DATE_KEY;
  });
  const race = findBuenosAiresMarathon(activities);
  const startMs = Date.parse(`${BUENOS_AIRES_CYCLE_START_KEY}T12:00:00Z`);
  const weekMs = 7 * 86400000;
  const weekCount = Math.ceil((Date.parse(`${BUENOS_AIRES_DATE_KEY}T12:00:00Z`) - startMs) / weekMs);
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const dateKey = new Date(startMs + index * weekMs).toISOString().slice(0, 10);
    return { dateKey, label: `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`, trainingKm: 0, raceKm: 0 };
  });
  for (const run of trainingRuns) {
    const index = Math.floor((Date.parse(`${getActivityLocalDateKey(run)}T12:00:00Z`) - startMs) / weekMs);
    if (weeks[index]) weeks[index].trainingKm += run.distance / 1000;
  }
  if (race && weeks.length) weeks[weeks.length - 1].raceKm = race.distance / 1000;
  return {
    race,
    elapsedSeconds: getRecordedRaceTime(race),
    trainingRuns,
    trainingKm: trainingRuns.reduce((sum, run) => sum + run.distance / 1000, 0),
    longestRunKm: trainingRuns.reduce((max, run) => Math.max(max, run.distance / 1000), 0),
    peakWeekKm: Math.max(0, ...weeks.map((week) => week.trainingKm)),
    weeks,
  };
}

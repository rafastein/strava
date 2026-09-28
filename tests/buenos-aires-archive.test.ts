import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBuenosAiresArchive,
  findBuenosAiresMarathon,
  formatArchiveDuration,
  formatArchivePace,
  getActivityLocalDateKey,
  getRecordedRaceTime,
} from "../app/lib/buenos-aires-archive";
import type { StravaActivitySummary } from "../app/lib/strava-client";

function activity(id: number, date: string, distance: number, overrides: Partial<StravaActivitySummary> = {}): StravaActivitySummary {
  return {
    id, name: "Corrida", type: "Run", distance, moving_time: 12000,
    elapsed_time: 12500, total_elevation_gain: 10,
    start_date: `${date}T10:00:00Z`, start_date_local: `${date}T07:00:00Z`,
    ...overrides,
  };
}

test("retrospectiva separa preparação, maratona e treinos posteriores", () => {
  const archive = buildBuenosAiresArchive([
    activity(1, "2026-05-17", 10000),
    activity(2, "2026-05-18", 10000),
    activity(3, "2026-08-29", 30000),
    activity(4, "2026-09-19", 5000),
    activity(5, "2026-09-20", 42500),
    activity(6, "2026-09-20", 1000), // warm-up does not become the race
    activity(7, "2026-09-28", 15000),
    activity(8, "2026-08-29", 60000, { type: "Ride" }),
  ]);
  assert.equal(archive.trainingKm, 45);
  assert.equal(archive.trainingRuns.length, 3);
  assert.equal(archive.longestRunKm, 30);
  assert.equal(archive.peakWeekKm, 30);
  assert.equal(archive.race?.id, 5);
  assert.equal(archive.weeks.length, 18);
  assert.equal(archive.weeks.at(-1)?.trainingKm, 5);
  assert.equal(archive.weeks.at(-1)?.raceKm, 42.5);
  assert.equal(archive.weeks.reduce((sum, week) => sum + week.trainingKm, 0), 45);
});

test("atividade da maratona exige data e distância compatíveis", () => {
  const runs = [
    activity(1, "2026-09-19", 42195),
    activity(2, "2026-09-20", 21100),
    activity(3, "2026-09-20", 42195, { type: "Ride" }),
    activity(4, "2026-09-20", 42195, { sport_type: "VirtualRun" }),
  ];
  assert.equal(findBuenosAiresMarathon(runs), null);
  assert.equal(findBuenosAiresMarathon([...runs, activity(5, "2026-09-20", 42300)])?.id, 5);
});

test("prefere atividade identificada como Buenos Aires entre registros compatíveis", () => {
  const runs = [activity(1, "2026-09-20", 42195), activity(2, "2026-09-20", 42400, { name: "Maratona de Buenos Aires" })];
  assert.equal(findBuenosAiresMarathon(runs)?.id, 2);
  assert.equal(runs[0].id, 1);
});

test("tempo exibido usa tempo decorrido e não substitui por tempo em movimento", () => {
  const run = activity(1, "2026-09-20", 42195);
  assert.equal(getRecordedRaceTime(run), 12500);
  assert.equal(getRecordedRaceTime({ ...run, elapsed_time: 0 }), null);
  assert.equal(getRecordedRaceTime(null), null);
  assert.equal(formatArchiveDuration(12500), "3:28:20");
  assert.equal(formatArchivePace(299.6), "5:00/km");
});

test("data local do Strava não recua para o dia anterior perto da meia-noite", () => {
  assert.equal(getActivityLocalDateKey({ start_date_local: "2026-09-20T00:30:00Z" }), "2026-09-20");
  assert.equal(getActivityLocalDateKey({ start_date: "2026-09-20T02:00:00Z" }), "2026-09-19");
  assert.equal(getActivityLocalDateKey({ start_date: "invalid" }), "");
});

test("sem dados não inventa resultado nem atividades de preparação", () => {
  const archive = buildBuenosAiresArchive([]);
  assert.equal(archive.race, null);
  assert.equal(archive.elapsedSeconds, null);
  assert.equal(archive.trainingRuns.length, 0);
  assert.equal(archive.trainingKm, 0);
  assert.equal(formatArchiveDuration(archive.elapsedSeconds), "—");
});

import test from "node:test";
import assert from "node:assert/strict";

import { buildStructuredWeeklyComparison } from "../app/lib/planned-weekly-comparison";
import type { StructuredPlannedWorkoutRangeResult } from "../app/lib/planned-workout";
import type { StravaActivitySummary } from "../app/lib/strava-client";

function workout(date: string, distanceKm: number): StructuredPlannedWorkoutRangeResult {
  return {
    date,
    source: "redis",
    sourceLabel: "Upstash/COROS",
    key: `planned-workout:${date}`,
    redisConfigured: true,
    data: {
      date,
      source: "coros",
      title: `Corrida ${distanceKm}`,
      type: "rodagem",
      distanceKm,
      durationMin: null,
      steps: [],
      importedAt: "2026-06-16T00:00:00.000Z",
    },
  };
}

function run(date: string, distanceKm: number): StravaActivitySummary {
  return {
    id: Number(date.replace(/\D/g, "")),
    name: "Corrida",
    type: "Run",
    sport_type: "Run",
    distance: distanceKm * 1000,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    start_date: `${date}T10:00:00Z`,
    start_date_local: `${date}T07:00:00Z`,
  };
}

test("buildStructuredWeeklyComparison mostra semana atual primeiro e próximas abaixo", () => {
  const result = buildStructuredWeeklyComparison(
    [
      workout("2026-06-09", 12),
      workout("2026-06-16", 10.5),
      workout("2026-06-18", 9),
      workout("2026-06-28", 17.9),
      workout("2026-07-05", 23),
    ],
    [run("2026-06-10", 8), run("2026-06-16", 11)],
    6,
    new Date("2026-06-16T12:00:00-03:00"),
  );

  assert.deepEqual(result.map((item) => item.label), [
    "15/06–21/06",
    "22/06–28/06",
    "29/06–05/07",
  ]);
  assert.equal(result[0].plannedKm, 19.5);
  assert.equal(result[0].executedKm, 11);
  assert.equal(result[1].plannedKm, 17.9);
  assert.equal(result[1].executedKm, 0);
});


test("buildStructuredWeeklyComparison inclui todas as semanas que tocam o mês de referência", () => {
  const result = buildStructuredWeeklyComparison(
    [
      workout("2026-06-16", 10.5),
      workout("2026-06-18", 9),
      workout("2026-06-28", 17.9),
      workout("2026-07-05", 23),
      workout("2026-07-07", 12),
    ],
    [
      run("2026-06-02", 12),
      run("2026-06-10", 44.6),
      run("2026-06-16", 11),
      run("2026-06-20", 39.2),
    ],
    6,
    new Date("2026-06-21T23:30:00-03:00"),
    { onlyWeeksTouchingReferenceMonth: true },
  );

  assert.deepEqual(result.map((item) => item.label), [
    "01/06–07/06",
    "08/06–14/06",
    "15/06–21/06",
    "22/06–28/06",
    "29/06–05/07",
  ]);
  assert.equal(result[0].plannedKm, 0);
  assert.equal(result[0].executedKm, 12);
  assert.equal(result[1].executedKm, 44.6);
  assert.equal(result[2].plannedKm, 19.5);
  assert.equal(result[2].executedKm, 50.2);
});

test("buildStructuredWeeklyComparison usa data do Brasil para definir semana atual", () => {
  const result = buildStructuredWeeklyComparison(
    [
      workout("2026-06-16", 10.5),
      workout("2026-06-18", 9),
      workout("2026-06-23", 10.5),
    ],
    [run("2026-06-16", 11)],
    6,
    new Date("2026-06-22T02:30:00.000Z"),
    { onlyWeeksTouchingReferenceMonth: true },
  );

  assert.equal(result[0].label, "15/06–21/06");
  assert.equal(result[0].executedKm, 11);
});

import test from "node:test";
import assert from "node:assert/strict";
import { summarizeEquipmentActivities } from "../app/lib/equipment-activity-summary";

test("resume o Fila Skytrail usando somente as três atividades TrailRun", () => {
  const gearId = "fila-skytrail";
  const stats = summarizeEquipmentActivities([
    {
      type: "Run",
      sport_type: "TrailRun",
      gear_id: gearId,
      distance: 6390,
      moving_time: 38 * 60 + 5,
      total_elevation_gain: 74,
      average_heartrate: 136,
      start_date: "2026-02-22T10:00:00Z",
      start_date_local: "2026-02-22T07:00:00-03:00",
    },
    {
      type: "Run",
      sport_type: "TrailRun",
      gear_id: gearId,
      distance: 5020,
      moving_time: 36 * 60,
      total_elevation_gain: 29,
      average_heartrate: 134,
      start_date: "2026-01-25T10:00:00Z",
      start_date_local: "2026-01-25T07:00:00-03:00",
    },
    {
      type: "Run",
      sport_type: "TrailRun",
      gear_id: gearId,
      distance: 8560,
      moving_time: 56 * 60 + 23,
      total_elevation_gain: 79,
      average_heartrate: 135,
      start_date: "2025-07-19T10:00:00Z",
      start_date_local: "2025-07-19T07:00:00-03:00",
    },
    {
      type: "Run",
      sport_type: "VirtualRun",
      gear_id: gearId,
      distance: 10530,
      moving_time: 45 * 60,
      total_elevation_gain: 0,
      start_date: "2026-03-01T10:00:00Z",
      start_date_local: "2026-03-01T07:00:00-03:00",
    },
  ]).get(gearId);

  assert.ok(stats);
  assert.equal(stats.activities, 3);
  assert.ok(Math.abs(stats.totalKm - 19.97) < 1e-9);
  assert.equal(stats.totalTime, 2 * 3600 + 10 * 60 + 28);
  assert.equal(stats.totalElevation, 182);
  assert.equal(stats.lastUse, "2026-02-22T07:00:00-03:00");

  const paceSecondsPerKm = stats.totalTime / stats.totalKm;
  assert.ok(Math.abs(paceSecondsPerKm - 392.0) < 0.1);
});

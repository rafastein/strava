import test from "node:test";
import assert from "node:assert/strict";
import { calcActivityTRIMP, calcTrainingLoad } from "../app/lib/training-load";

test("calcActivityTRIMP usa TrailRun e ignora atividades que não são corrida", () => {
  const trailLoad = calcActivityTRIMP(
    {
      id: 1,
      type: "TrailRun",
      sport_type: "TrailRun",
      start_date_local: "2026-06-08T07:00:00",
      moving_time: 3600,
      distance: 10_000,
      average_heartrate: 150,
    },
    { hrMax: 190, hrRest: 50 },
  );

  const bikeLoad = calcActivityTRIMP({
    id: 2,
    type: "Ride",
    sport_type: "Ride",
    start_date_local: "2026-06-08T07:00:00",
    moving_time: 3600,
    distance: 30_000,
    average_heartrate: 150,
  });

  assert.ok(trailLoad > 0);
  assert.equal(bikeLoad, 0);
});

test("calcTrainingLoad respeita displayDays e usa warmup sem expor dias extras", () => {
  const days = calcTrainingLoad(
    [
      {
        id: 1,
        type: "Run",
        sport_type: "Run",
        start_date_local: "2026-06-06T07:00:00",
        moving_time: 3600,
        distance: 10_000,
        average_heartrate: 145,
      },
      {
        id: 2,
        type: "Run",
        sport_type: "Run",
        start_date_local: "2026-06-08T07:00:00",
        moving_time: 3600,
        distance: 10_000,
        average_heartrate: 150,
      },
    ],
    {
      today: "2026-06-10",
      displayDays: 3,
      warmupDays: 2,
      hrMax: 190,
      hrRest: 50,
      thresholdPaceSecPerKm: 260,
    },
  );

  assert.equal(days.length, 3);
  assert.deepEqual(days.map((day) => day.date), ["2026-06-08", "2026-06-09", "2026-06-10"]);
  assert.ok(days[0].trimp > 0);
  assert.ok(days[0].ctl > 0);
  assert.ok(days[2].ctl > 0);
});

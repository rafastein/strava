import test from "node:test";
import assert from "node:assert/strict";
import { isRunActivity, STRAVA_RUN_SPORT_TYPES } from "../app/lib/strava-activity";

test("isRunActivity aceita os tipos de corrida usados pelo Strava", () => {
  assert.equal(isRunActivity({ type: "Run" }), true);
  assert.equal(isRunActivity({ sport_type: "TrailRun" }), true);
  assert.equal(isRunActivity({ type: "VirtualRun" }), true);
});

test("isRunActivity rejeita atividades que não são corrida", () => {
  assert.equal(isRunActivity({ type: "Ride" }), false);
  assert.equal(isRunActivity({ sport_type: "Workout" }), false);
  assert.equal(isRunActivity(null), false);
});

test("STRAVA_RUN_SPORT_TYPES mantém a lista esperada", () => {
  assert.deepEqual(Array.from(STRAVA_RUN_SPORT_TYPES).sort(), ["Run", "TrailRun", "VirtualRun"]);
});

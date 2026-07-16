import test from "node:test";
import assert from "node:assert/strict";
import {
  isEquipmentRunActivity,
  isRunActivity,
  STRAVA_EQUIPMENT_RUN_SPORT_TYPES,
  STRAVA_RUN_SPORT_TYPES,
} from "../app/lib/strava-activity";

test("isRunActivity aceita os tipos gerais de corrida usados pelo Strava", () => {
  assert.equal(isRunActivity({ type: "Run" }), true);
  assert.equal(isRunActivity({ sport_type: "TrailRun" }), true);
  assert.equal(isRunActivity({ type: "VirtualRun" }), true);
});

test("isRunActivity rejeita atividades que não são corrida", () => {
  assert.equal(isRunActivity({ type: "Ride" }), false);
  assert.equal(isRunActivity({ sport_type: "Workout" }), false);
  assert.equal(isRunActivity(null), false);
});

test("isEquipmentRunActivity aceita somente Run e TrailRun", () => {
  assert.equal(isEquipmentRunActivity({ type: "Run" }), true);
  assert.equal(isEquipmentRunActivity({ sport_type: "TrailRun", type: "Run" }), true);
  assert.equal(isEquipmentRunActivity({ type: "TrailRun" }), true);
});

test("isEquipmentRunActivity exclui VirtualRun mesmo quando type é Run", () => {
  assert.equal(isEquipmentRunActivity({ type: "VirtualRun" }), false);
  assert.equal(isEquipmentRunActivity({ type: "Run", sport_type: "VirtualRun" }), false);
});

test("isEquipmentRunActivity dá prioridade ao sport_type e rejeita outros esportes", () => {
  assert.equal(isEquipmentRunActivity({ type: "Run", sport_type: "Walk" }), false);
  assert.equal(isEquipmentRunActivity({ type: "Run", sport_type: "Hike" }), false);
  assert.equal(isEquipmentRunActivity({ type: "Ride" }), false);
  assert.equal(isEquipmentRunActivity(null), false);
});

test("listas de tipos mantêm os valores esperados", () => {
  assert.deepEqual(Array.from(STRAVA_RUN_SPORT_TYPES).sort(), ["Run", "TrailRun", "VirtualRun"]);
  assert.deepEqual(Array.from(STRAVA_EQUIPMENT_RUN_SPORT_TYPES).sort(), ["Run", "TrailRun"]);
});

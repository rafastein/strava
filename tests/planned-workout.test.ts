import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStructuredWorkout,
  getPlannedWorkoutKey,
  normalizeStructuredWorkout,
  PLANNED_WORKOUT_KEY_PREFIX,
} from "../app/lib/planned-workout";
import { getEquipmentWorkoutFromStructuredWorkout } from "../app/lib/equipment-recommendation";

test("planned workout usa chave por data", () => {
  assert.equal(PLANNED_WORKOUT_KEY_PREFIX, "planned-workout:");
  assert.equal(getPlannedWorkoutKey("2026-06-11"), "planned-workout:2026-06-11");
});

test("classifica treino estruturado com repetição curta como intervalado", () => {
  const type = classifyStructuredWorkout({
    title: "2 km Z1 + 7x 500m Z2 / 500m Z1",
    steps: [
      { label: "Aquecimento", distanceKm: 2, intensity: "Z1" },
      { label: "500m Z2", repeat: 7, distanceKm: 0.5, intensity: "Z2" },
      { label: "500m Z1", repeat: 7, distanceKm: 0.5, intensity: "Z1" },
    ],
  });

  assert.equal(type, "intervalado");
});

test("normaliza payload vindo do COROS/manual", () => {
  const workout = normalizeStructuredWorkout({
    date: "2026-06-11",
    source: "coros",
    title: "7x 500m",
    distanceKm: "9",
    durationMin: "60",
    steps: [{ label: "500m Z2", repeat: 7, distanceKm: 0.5, intensity: "Z2" }],
  });

  assert.equal(workout.date, "2026-06-11");
  assert.equal(workout.source, "coros");
  assert.equal(workout.type, "intervalado");
  assert.equal(workout.distanceKm, 9);
  assert.equal(workout.durationMin, 60);
  assert.equal(workout.steps.length, 1);
});

test("equipamentos prioriza treino estruturado como fonte", () => {
  const workout = normalizeStructuredWorkout({
    date: "2026-06-11",
    source: "coros",
    title: "7x 500m",
    steps: [{ label: "500m Z2", repeat: 7, distanceKm: 0.5, intensity: "Z2" }],
  });

  const equipmentWorkout = getEquipmentWorkoutFromStructuredWorkout(workout);

  assert.equal(equipmentWorkout.source, "structured-workout");
  assert.equal(equipmentWorkout.status, "planned");
  assert.equal(equipmentWorkout.type, "intervalado");
  assert.equal(equipmentWorkout.label, "Intervalado");
});

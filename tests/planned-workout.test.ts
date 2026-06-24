import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStructuredWorkout,
  formatPlannedWorkoutDateWithWeekdayLabel,
  getIsoDatesForRange,
  getPlannedWorkoutKey,
  getStructuredWorkoutPlannedDistanceKm,
  isStructuredRunningWorkout,
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
    estimatedTime: "1:00:00",
    loadTl: "97",
    steps: [{ label: "500m Z2", repeat: 7, distanceKm: 0.5, intensity: "Z2" }],
  });

  assert.equal(workout.date, "2026-06-11");
  assert.equal(workout.source, "coros");
  assert.equal(workout.type, "intervalado");
  assert.equal(workout.distanceKm, 9);
  assert.equal(workout.durationMin, 60);
  assert.equal(workout.estimatedTime, "1:00:00");
  assert.equal(workout.loadTl, 97);
  assert.equal(workout.steps.length, 1);
});


test("normaliza campos oficiais do COROS salvos dentro de raw", () => {
  const workout = normalizeStructuredWorkout({
    date: "2026-06-25",
    source: "coros",
    title: "25/06 Qui - Corrida Fartlek 10",
    distanceKm: 10,
    raw: {
      corosSchedule: {
        estimatedTime: "1:02:36",
        loadTl: 104,
      },
    },
  });

  assert.equal(workout.estimatedTime, "1:02:36");
  assert.equal(workout.durationMin, 63);
  assert.equal(workout.loadTl, 104);
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


test("range de treinos estruturados gera datas ISO em sequência", () => {
  const dates = getIsoDatesForRange(3, new Date("2026-06-13T12:00:00-03:00"));

  assert.deepEqual(dates, ["2026-06-13", "2026-06-14", "2026-06-15"]);
});

test("helpers de treino estruturado diferenciam corrida de descanso", () => {
  const run = normalizeStructuredWorkout({
    date: "2026-06-21",
    source: "coros",
    title: "Longo 25 km",
    distanceKm: 25,
  });
  const rest = normalizeStructuredWorkout({
    date: "2026-06-22",
    source: "coros",
    title: "Descanso",
    type: "descanso",
  });

  assert.equal(isStructuredRunningWorkout(run), true);
  assert.equal(getStructuredWorkoutPlannedDistanceKm(run), 25);
  assert.equal(isStructuredRunningWorkout(rest), false);
  assert.equal(getStructuredWorkoutPlannedDistanceKm(rest), 0);
});

test("formats planned workout labels with weekday", () => {
  assert.equal(formatPlannedWorkoutDateWithWeekdayLabel("2026-06-21"), "21/06/2026 · dom");
});

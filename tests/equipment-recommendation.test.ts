import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyEquipmentWorkout,
  getTodayEquipmentWorkout,
  inferShoeProfile,
  pickRecommendedShoeForWorkout,
  type GearForRecommendation,
} from "../app/lib/equipment-recommendation";
import type { SisrunParsedData } from "../app/lib/sisrun-utils";

const shoes: GearForRecommendation[] = [
  { gearId: "sb2", name: "ASICS Superblast 2", brand: "asics", totalKm: 120, maxKm: 800 },
  { gearId: "evo", name: "Adidas Evo SL", brand: "adidas", totalKm: 80, maxKm: 800 },
  { gearId: "ap4", name: "Adidas Adios Pro 4", brand: "adidas", totalKm: 20, maxKm: 500 },
  { gearId: "cloud", name: "On Cloudsurfer Next", brand: "on", totalKm: 220, maxKm: 700 },
];

test("classifyEquipmentWorkout identifica longão por tipo ou distância", () => {
  assert.equal(
    classifyEquipmentWorkout({ dateLabel: "13/06/2026", workoutType: "Longo", plannedDistanceKm: 24 }),
    "longao",
  );

  assert.equal(
    classifyEquipmentWorkout({ dateLabel: "13/06/2026", workoutType: "Treino", plannedDistanceKm: 18 }),
    "longao",
  );
});

test("classifyEquipmentWorkout identifica intervalado por pista, tiros ou Z5", () => {
  assert.equal(
    classifyEquipmentWorkout({ dateLabel: "11/06/2026", workoutType: "Treino", intensity: "Z5", description: "7x 500m na pista", plannedDistanceKm: 9 }),
    "intervalado",
  );
});

test("getTodayEquipmentWorkout retorna descanso quando o dia está sem treino", () => {
  const data: SisrunParsedData = {
    athleteName: "Rafael",
    rows: [{ date: "10/06/2026", plannedDistanceKm: 0, completedDistanceKm: 0, minPlannedTime: null, maxPlannedTime: null }],
    weeks: [],
  };

  const workout = getTodayEquipmentWorkout(data, new Date("2026-06-10T12:00:00-03:00"));
  assert.equal(workout.status, "rest");
  assert.equal(workout.type, null);
});

test("getTodayEquipmentWorkout usa workouts detalhados das semanas quando existem", () => {
  const data: SisrunParsedData = {
    athleteName: "Rafael",
    rows: [],
    weeks: [
      {
        weekStart: "08/06/2026",
        weekEnd: "14/06/2026",
        totalPlannedKm: 35,
        longRunPlannedKm: 20,
        workouts: [
          {
            dateLabel: "10/06/2026",
            workoutType: "Treino",
            intensity: "Z3",
            plannedDistanceKm: 10,
            description: "Ritmo de maratona",
          },
        ],
      },
    ],
  };

  const workout = getTodayEquipmentWorkout(data, new Date("2026-06-10T12:00:00-03:00"));
  assert.equal(workout.status, "planned");
  assert.equal(workout.type, "ritmo");
  assert.equal(workout.distanceKm, 10);
});

test("pickRecommendedShoeForWorkout preserva tênis de prova em treino comum", () => {
  const workout = {
    status: "planned" as const,
    type: "intervalado" as const,
    label: "Intervalado",
    dateLabel: "10/06/2026",
    distanceKm: 9,
    source: "sisrun-workout" as const,
    evidence: [],
  };

  const recommendation = pickRecommendedShoeForWorkout(shoes, workout);
  assert.equal(recommendation?.name, "Adidas Evo SL");
});

test("pickRecommendedShoeForWorkout libera tênis de placa para prova longa", () => {
  const workout = {
    status: "planned" as const,
    type: "prova_longa" as const,
    label: "Prova longa",
    dateLabel: "20/09/2026",
    distanceKm: 42.195,
    source: "sisrun-workout" as const,
    evidence: [],
  };

  const recommendation = pickRecommendedShoeForWorkout(shoes, workout);
  assert.equal(recommendation?.name, "Adidas Adios Pro 4");
});

test("inferShoeProfile identifica modelos pelo nome do Strava, não pelo id", () => {
  assert.equal(inferShoeProfile("Meu Adidas Adios Pro 4").key, "adidas-adios-pro-4");
  assert.equal(inferShoeProfile("ASICS Superblast 2 - treino").key, "asics-superblast-2");
});

test("getTodayEquipmentWorkout não trata como descanso quando SisRUN tem treino sem distância, mas com janela de tempo", () => {
  const data: SisrunParsedData = {
    athleteName: "Rafael",
    rows: [
      {
        date: "11/06/2026",
        plannedWorkouts: 1,
        plannedDistanceKm: 0,
        completedDistanceKm: 0,
        minPlannedTime: "00:47:24",
        maxPlannedTime: "01:00:36",
      },
    ],
    weeks: [
      {
        weekStart: "08/06/2026",
        weekEnd: "14/06/2026",
        totalPlannedKm: 0,
        longRunPlannedKm: 0,
        workoutCount: 1,
        workouts: [
          {
            dateLabel: "11/06/2026",
            workoutType: "Treino",
            plannedDistanceKm: null,
            description: "Sem treino realizado registrado",
            minTime: "00:47:24",
            maxTime: "01:00:36",
          },
        ],
      },
    ],
  };

  const workout = getTodayEquipmentWorkout(data, new Date("2026-06-11T12:00:00-03:00"));
  assert.equal(workout.status, "planned");
  assert.equal(workout.type, "rodagem");
  assert.equal(workout.distanceKm, null);
  assert.equal(workout.evidence.includes("Sem treino realizado registrado"), false);
});

test("classifyEquipmentWorkout usa fallback de rodagem para treino genérico sem intensidade explícita", () => {
  assert.equal(
    classifyEquipmentWorkout(
      { dateLabel: "12/06/2026", workoutType: "Treino", plannedDistanceKm: null, minTime: "00:40:00", maxTime: "00:50:00" },
      { date: "12/06/2026", plannedWorkouts: 1, plannedDistanceKm: 0, completedDistanceKm: 0, minPlannedTime: "00:40:00", maxPlannedTime: "00:50:00" },
    ),
    "rodagem",
  );
});

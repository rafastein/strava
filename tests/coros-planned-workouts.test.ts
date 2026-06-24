import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCorosScheduleWorkouts,
  dedupeCorosScheduleWorkouts,
  normalizeCorosScheduleEntry,
  parseCorosDurationToMinutes,
  parseCorosTrainingScheduleText,
} from "../app/lib/coros-planned-workouts";

test("converte duração COROS para minutos", () => {
  assert.equal(parseCorosDurationToMinutes("54:00"), 54);
  assert.equal(parseCorosDurationToMinutes("2:07:33"), 128);
});

test("normaliza entrada COROS como treino estruturado", () => {
  const workout = normalizeCorosScheduleEntry({
    date: "2026-06-11",
    title: "11/06 Qui - Corrida Intervalad",
    distanceKm: 9,
    estimatedTime: "54:00",
    loadTl: 73,
  });

  assert.equal(workout.date, "2026-06-11");
  assert.equal(workout.source, "coros");
  assert.equal(workout.type, "intervalado");
  assert.equal(workout.distanceKm, 9);
  assert.equal(workout.durationMin, 54);
  assert.equal(workout.estimatedTime, "54:00");
  assert.equal(workout.loadTl, 73);
  assert.equal(workout.description, "Carga COROS: 73 TL");
});

test("deduplica agenda COROS respeitando preferência por data", () => {
  const workouts = [
    normalizeCorosScheduleEntry({
      date: "2026-06-13",
      title: "13/06 Sab - Corrida Longo 23,0",
      distanceKm: 23,
      estimatedTime: "2:02:19",
      loadTl: 236,
    }),
    normalizeCorosScheduleEntry({
      date: "2026-06-13",
      title: "Longão 23k",
      distanceKm: 23,
      estimatedTime: "2:07:33",
      loadTl: 203,
    }),
  ];

  const deduped = dedupeCorosScheduleWorkouts(workouts, { "2026-06-13": "Longão 23k" });

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].title, "Longão 23k");
  assert.equal(deduped[0].durationMin, 128);
  assert.equal(deduped[0].estimatedTime, "2:07:33");
  assert.equal(deduped[0].loadTl, 203);
});

test("parseia texto bruto do MCP COROS", () => {
  const text = `Training Schedule
========================

2026-06-11
11/06 Qui - Corrida Intervalad
Distance: 9.00 km
Estimated Time: 54:00
Load: 73 TL

2026-06-13
Longão 23k
Distance: 23.00 km
Estimated Time: 2:07:33
Load: 203 TL`;

  const entries = parseCorosTrainingScheduleText(text);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].date, "2026-06-11");
  assert.equal(entries[0].distanceKm, "9.00");
  assert.equal(entries[1].title, "Longão 23k");
});

test("build da agenda COROS remove duplicidade do dia 13/06", () => {
  const workouts = buildCorosScheduleWorkouts({
    preferredTitlesByDate: { "2026-06-13": "Longão 23k" },
    entries: [
      {
        date: "2026-06-13",
        title: "13/06 Sab - Corrida Longo 23,0",
        distanceKm: 23,
        estimatedTime: "2:02:19",
        loadTl: 236,
      },
      {
        date: "2026-06-13",
        title: "Longão 23k",
        distanceKm: 23,
        estimatedTime: "2:07:33",
        loadTl: 203,
      },
      {
        date: "2026-06-14",
        title: "14/06 Dom - Corrida Regenerati",
        distanceKm: 4.58,
        estimatedTime: "30:00",
        loadTl: 29,
      },
    ],
  });

  assert.equal(workouts.length, 2);
  assert.equal(workouts[0].date, "2026-06-13");
  assert.equal(workouts[0].title, "Longão 23k");
  assert.equal(workouts[1].type, "regenerativo");
});

test("parse COROS por blocos sem deslocar distância entre datas", () => {
  const text = `Training Schedule
========================

2026-06-20
20/06 Sab - Corrida Prova 10,0
Workout ID: abc
Distance: 10.00 km
Estimated Time: 51:20
Load: 108 TL

2026-06-21
21/06 Dom - Corrida Longo 25,0
Distance: 25.00 km
Estimated Time: 2:12:35
Load: 257 TL`;

  const entries = parseCorosTrainingScheduleText(text);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].date, "2026-06-20");
  assert.equal(entries[0].title, "20/06 Sab - Corrida Prova 10,0");
  assert.equal(entries[0].distanceKm, "10.00");
  assert.equal(entries[1].date, "2026-06-21");
  assert.equal(entries[1].title, "21/06 Dom - Corrida Longo 25,0");
  assert.equal(entries[1].distanceKm, "25.00");
});

test("normalização COROS usa data do título quando o MCP vier deslocado", () => {
  const workout = normalizeCorosScheduleEntry({
    date: "2026-06-20",
    title: "21/06 Dom - Corrida Longo 25,0",
    distanceKm: 25,
    estimatedTime: "2:12:35",
    loadTl: 257,
  });

  assert.equal(workout.date, "2026-06-21");
  assert.equal(workout.distanceKm, 25);
  assert.equal(workout.type, "longao");
  assert.equal(workout.estimatedTime, "2:12:35");
  assert.equal(workout.loadTl, 257);
});

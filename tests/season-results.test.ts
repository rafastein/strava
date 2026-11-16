import test from "node:test";
import assert from "node:assert/strict";

import { getResultSeasons, resolveSeasonResults } from "../app/lib/season-results";

const race = (dateKey: string, name: string, distanceKm = 21.1, extra: object = {}) => ({
  id: `${dateKey}-${name}`, name, dateKey, location: "Brasil", distanceKm, featured: true, ...extra,
});
const run = (id: number, dateKey: string, km: number, elapsed: number, type = "Run") => ({
  id, type, distance: km * 1000, moving_time: elapsed - 30, elapsed_time: elapsed, start_date_local: `${dateKey}T06:00:00Z`,
});

const races = [
  race("2026-03-29", "Meia de Berlim", 21.1, { badge: "SuperHalfs" }),
  race("2026-06-06", "Meia do Rio"),
  race("2026-07-12", "Cats Run", 5, { featured: false }),
  race("2026-08-22", "Quatro Poderes 10K", 10, { featured: false }),
  race("2026-08-30", "Run The Bridge", 30),
  race("2026-11-15", "Meia de Curitiba"),
  race("2027-03-07", "Meia do Recife"),
];
const activities = [
  run(1, "2026-03-29", 21.2, 5889),
  run(2, "2026-06-06", 21.15, 5691),
  run(3, "2026-06-06", 3, 900), // aquecimento no dia da prova não conta
  run(4, "2026-07-12", 5.02, 1197),
  run(5, "2026-08-22", 10, 2900),
  run(6, "2026-03-29", 21.1, 4000, "Ride"),
];
const prs = { km5: { activityId: 4 }, km10: null, half: { activityId: 2 }, marathon: null };

test("resultados casam prova e corrida do dia, do mais recente ao mais antigo", () => {
  const results = resolveSeasonResults(races, activities, prs, "2026-11-13", 2026);
  assert.deepEqual(results.map((r) => r.name), ["Run The Bridge", "Cats Run", "Meia do Rio", "Meia de Berlim"]);

  const rio = results.find((r) => r.name === "Meia do Rio");
  assert.equal(rio?.timeSec, 5691);
  assert.equal(rio?.activityId, 2);
  assert.equal(rio?.isPR, true);
  assert.equal(results.find((r) => r.name === "Meia de Berlim")?.isPR, false);
  // Prova passada sem corrida no Strava aparece sem tempo.
  assert.equal(results.find((r) => r.name === "Run The Bridge")?.timeSec, null);
});

test("prova não destacada só entra como recorde; futuras e outros anos ficam fora", () => {
  const results = resolveSeasonResults(races, activities, prs, "2026-11-13", 2026);
  assert.ok(results.some((r) => r.name === "Cats Run" && r.isPR));
  assert.ok(!results.some((r) => r.name === "Quatro Poderes 10K"));
  assert.ok(!results.some((r) => r.name === "Meia de Curitiba"));
  assert.ok(!results.some((r) => r.name === "Meia do Recife"));
  assert.deepEqual(resolveSeasonResults(races, activities, prs, "2027-04-01", 2027).map((r) => r.name), ["Meia do Recife"]);
});

test("prova de hoje só vira resultado depois que a corrida sincroniza", () => {
  assert.ok(!resolveSeasonResults(races, activities, prs, "2026-11-15", 2026).some((r) => r.name === "Meia de Curitiba"));
  const synced = [...activities, run(9, "2026-11-15", 21.1, 5700)];
  assert.equal(resolveSeasonResults(races, synced, prs, "2026-11-15", 2026)[0].name, "Meia de Curitiba");
});

test("temporadas disponíveis não incluem anos futuros", () => {
  assert.deepEqual(getResultSeasons(races, 2026), [2026]);
  assert.deepEqual(getResultSeasons([...races, { dateKey: "2025-10-05" }], 2026), [2026, 2025]);
  assert.deepEqual(getResultSeasons([], 2027), [2027]);
});

test("corridas marcadas \"Prova:\" entram nos resultados, sem o marcador e sem duplicar", () => {
  const tagged = [
    ...activities.map((a) => (a.id === 5 ? { ...a, name: "Prova: Quatro Poderes" } : a)),
    { ...run(7, "2026-10-04", 10.05, 2700), name: "Prova: Corrida da Ponte" },
    { ...run(8, "2026-06-06", 21.15, 5691), name: "prova: Meia do Rio repetida" }, // outra atividade, mesmo dia
    { ...run(9, "2026-10-11", 8, 2400), name: "Treino leve" },
    { ...run(10, "2026-10-12", 12, 3600, "Ride"), name: "Prova: pedal" },
    { ...run(11, "2026-12-01", 10, 2700), name: "Prova: futura" },
  ];
  const results = resolveSeasonResults(races, tagged, prs, "2026-11-13", 2026);
  const names = results.map((r) => r.name);

  // Prova cadastrada não destacada passa a aparecer quando a corrida tem "Prova:".
  assert.ok(names.includes("Quatro Poderes 10K"));
  const ponte = results.find((r) => r.name === "Corrida da Ponte");
  assert.equal(ponte?.activityId, 7);
  assert.equal(ponte?.distanceKm, 10.1);
  assert.equal(ponte?.timeSec, 2700);
  assert.ok(names.includes("Meia do Rio repetida"));
  assert.ok(!names.some((n) => /treino|pedal|futura/i.test(n)));
  assert.equal(results.filter((r) => r.activityId === 2).length, 1);
});

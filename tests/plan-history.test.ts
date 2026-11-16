import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlanHistory,
  getCorosPlannedKmByDate,
  getHistoryStartKey,
  getPlannedKmUntil,
  getSisrunPlannedKmByDate,
  summarizePlanHistory,
} from "../app/lib/plan-history";

function run(dateKey: string, km: number) {
  return { type: "Run", sport_type: "Run", distance: km * 1000, start_date_local: `${dateKey}T06:30:00Z` };
}

test("SisRUN: datas dd/mm/aaaa viram chaves e a linha Resumo é ignorada", () => {
  const map = getSisrunPlannedKmByDate([
    { date: "16/11/2026", plannedDistanceKm: 8 },
    { date: "17/11/2026", plannedDistanceKm: 0 },
    { date: "Resumo", plannedDistanceKm: 900 },
  ]);
  assert.deepEqual([...map.entries()], [["2026-11-16", 8]]);
});

test("COROS: só corrida com distância, somando treinos do mesmo dia", () => {
  const workout = (date: string, type: string, distanceKm: number | null) =>
    ({ key: date, date, data: { date, type, distanceKm } }) as unknown as Parameters<typeof getCorosPlannedKmByDate>[0][number];
  const map = getCorosPlannedKmByDate([
    workout("2026-11-17", "rodagem", 10),
    workout("2026-11-17", "regenerativo", 4),
    workout("2026-11-18", "descanso", null),
    workout("2026-11-19", "forca", 0),
  ]);
  assert.deepEqual([...map.entries()], [["2026-11-17", 14]]);
});

test("início do histórico é a segunda-feira N semanas antes", () => {
  assert.equal(getHistoryStartKey("2026-11-18", 0), "2026-11-16");
  assert.equal(getHistoryStartKey("2026-11-18", 2), "2026-11-02");
  assert.equal(getHistoryStartKey("2026-01-01", 1), "2025-12-22");
});

test("cada semana usa uma fonte: COROS quando existe, senão SisRUN", () => {
  const coros = new Map([["2026-11-17", 10]]);
  const sisrun = new Map([["2026-11-18", 99], ["2026-11-10", 12], ["2026-11-12", 8]]);
  const history = buildPlanHistory({
    activities: [run("2026-11-17", 9.5), run("2026-11-10", 12), run("2026-11-13", 6)],
    corosByDate: coros,
    sisrunByDate: sisrun,
    todayKey: "2026-11-18",
    weeks: 3,
  });

  assert.deepEqual(history.map((week) => week.weekStartKey), ["2026-11-16", "2026-11-09", "2026-11-02"]);
  assert.deepEqual(history.map((week) => week.source), ["COROS", "SisRUN", null]);
  assert.equal(history[0].plannedKm, 10); // o SisRUN da mesma semana fica de fora
  assert.equal(history[0].isCurrent, true);
  assert.equal(history[0].days[2].isToday, true);
  assert.equal(history[1].plannedKm, 20);
  assert.equal(history[1].km, 18);
  assert.equal(history[1].adherencePct, 90);
  assert.equal(history[2].adherencePct, null);
});

test("resumo considera só semanas encerradas com plano", () => {
  const history = buildPlanHistory({
    activities: [run("2026-11-17", 3), run("2026-11-10", 12), run("2026-11-03", 5)],
    corosByDate: new Map(),
    sisrunByDate: new Map([["2026-11-17", 10], ["2026-11-10", 15]]),
    todayKey: "2026-11-18",
    weeks: 3,
  });
  assert.deepEqual(summarizePlanHistory(history), { weeks: 1, plannedKm: 15, km: 12, adherencePct: 80 });
});

test("planejado até agora: dias passados contam, hoje só depois de correr", () => {
  const [week] = buildPlanHistory({
    activities: [],
    corosByDate: new Map([["2026-11-16", 8], ["2026-11-18", 6], ["2026-11-22", 20]]),
    sisrunByDate: new Map(),
    todayKey: "2026-11-18",
    weeks: 1,
  });
  assert.equal(getPlannedKmUntil(week, "2026-11-18"), 8);

  const [ranToday] = buildPlanHistory({
    activities: [run("2026-11-18", 6)],
    corosByDate: new Map([["2026-11-16", 8], ["2026-11-18", 6], ["2026-11-22", 20]]),
    sisrunByDate: new Map(),
    todayKey: "2026-11-18",
    weeks: 1,
  });
  assert.equal(getPlannedKmUntil(ranToday, "2026-11-18"), 14);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWeekDays,
  daysBetweenDateKeys,
  formatCountdown,
  getPrKeyForRaceDistance,
  getWeekDateKeys,
} from "../app/lib/home-week";

const run = (date: string, km: number, type = "Run") => ({
  type,
  distance: km * 1000,
  start_date_local: `${date}T06:10:00Z`,
});

test("semana vai de segunda a domingo, inclusive quando hoje é domingo", () => {
  assert.deepEqual(getWeekDateKeys("2026-11-13"), [
    "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
  ]);
  assert.equal(getWeekDateKeys("2026-11-15")[0], "2026-11-09");
  // Semana que atravessa a virada do ano.
  assert.deepEqual(getWeekDateKeys("2027-01-01").slice(0, 2), ["2026-12-28", "2026-12-29"]);
});

test("dias da semana somam só corridas e marcam hoje e o dia da prova", () => {
  const days = buildWeekDays(
    [run("2026-11-10", 9.5), run("2026-11-12", 8.44), run("2026-11-12", 2), run("2026-11-11", 30, "Ride"), run("2026-11-08", 10)],
    "2026-11-13",
    ["2026-11-15"],
  );
  assert.deepEqual(days.map((day) => day.weekday), ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]);
  assert.equal(days[1].km, 9.5);
  assert.equal(Number(days[3].km.toFixed(2)), 10.44);
  assert.equal(days[3].runs, 2);
  assert.equal(days[2].km, 0);
  assert.equal(days.filter((day) => day.isToday).map((day) => day.weekday).join(), "sex");
  assert.equal(days.filter((day) => day.isRaceDay).map((day) => day.weekday).join(), "dom");
});

test("contagem regressiva e recorde por distância", () => {
  assert.equal(daysBetweenDateKeys("2026-11-13", "2026-11-15"), 2);
  assert.equal(daysBetweenDateKeys("2026-11-13", "2027-03-07"), 114);
  assert.deepEqual(formatCountdown(2), { value: "2", unit: "dias" });
  assert.deepEqual(formatCountdown(1), { value: "1", unit: "dia" });
  assert.deepEqual(formatCountdown(0), { value: "Hoje", unit: "" });
  assert.equal(getPrKeyForRaceDistance(21.1), "half");
  assert.equal(getPrKeyForRaceDistance(42.195), "marathon");
  assert.equal(getPrKeyForRaceDistance(15), null);
});

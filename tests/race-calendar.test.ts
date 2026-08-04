import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MANAGED_RACES,
  getRaceCalendarTodayKey,
  getUpcomingManagedRaces,
  sanitizeRaces,
  toDashboardRaces,
  toMarathonCycleRaces,
  toSeasonRaceMonths,
} from "../app/lib/race-calendar";

test("calendário de provas gera dashboard ordenado por data", () => {
  const races = sanitizeRaces([
    { name: "Prova B", dateKey: "2026-08-10", location: "Brasil", distanceKm: 10, objective: "Treino", featured: true },
    { name: "Prova A", dateKey: "2026-07-10", location: "Brasil", distanceKm: 5, objective: "Treino", featured: false },
  ]);

  const dashboard = toDashboardRaces(races);
  assert.equal(dashboard[0].name, "Prova A");
  assert.equal(dashboard[0].date, "2026-07-10T07:00:00-03:00");
});

test("calendário de provas gera meses da temporada e ciclo de maratona", () => {
  const months = toSeasonRaceMonths(DEFAULT_MANAGED_RACES);
  const cycle = toMarathonCycleRaces(DEFAULT_MANAGED_RACES);

  assert.ok(months.some((month) => month.label === "JUN"));
  assert.ok(cycle.some((race) => race.dateKey === "2026-09-20" && race.isGoal));
});


test("página de provas mantém apenas corridas de hoje em diante", () => {
  const races = sanitizeRaces([
    { name: "Passada", dateKey: "2026-08-02", location: "Brasil", distanceKm: 5, objective: "Treino", featured: true },
    { name: "Hoje", dateKey: "2026-08-03", location: "Brasil", distanceKm: 10, objective: "Prova", featured: true },
    { name: "Futura", dateKey: "2026-08-09", location: "Brasil", distanceKm: 21.1, objective: "Prova", featured: true },
  ]);

  const upcoming = getUpcomingManagedRaces(races, "2026-08-03");
  assert.deepEqual(upcoming.map((race) => race.name), ["Hoje", "Futura"]);
});

test("data atual do calendário respeita o fuso de São Paulo", () => {
  assert.equal(getRaceCalendarTodayKey(new Date("2026-08-04T01:30:00Z")), "2026-08-03");
});

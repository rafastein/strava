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
  const months = toSeasonRaceMonths(DEFAULT_MANAGED_RACES, "2026-06-01");
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

test("missão salva antes da prova deixa de fixar Buenos Aires no futuro", () => {
  const before = toSeasonRaceMonths(DEFAULT_MANAGED_RACES, "2026-09-19");
  const after = toSeasonRaceMonths(DEFAULT_MANAGED_RACES, "2026-09-28");
  const findBuenosAires = (months: ReturnType<typeof toSeasonRaceMonths>) =>
    months.flatMap((month) => month.races).find((race) => race.name === "Buenos Aires");
  assert.equal(findBuenosAires(before)?.fixedStatus, "mission");
  assert.equal(findBuenosAires(after)?.fixedStatus, undefined);
  assert.equal(DEFAULT_MANAGED_RACES.find((race) => race.name === "Buenos Aires")?.fixedStatus, "mission");
  assert.ok(!getUpcomingManagedRaces(DEFAULT_MANAGED_RACES, "2026-09-28").some((race) => race.name === "Buenos Aires"));
});

test("calendário da temporada não mistura provas de outros anos", () => {
  const races = sanitizeRaces([
    { name: "Meia de Berlim", dateKey: "2026-03-29", location: "Berlim", distanceKm: 21.1, objective: "Prova", featured: true },
    { name: "Meia de Curitiba", dateKey: "2026-11-15", location: "Curitiba", distanceKm: 21.1, objective: "Prova", featured: true },
    { name: "Meia Maratona do Recife", dateKey: "2027-03-07", location: "Recife", distanceKm: 21.1, objective: "Prova", featured: true },
  ]);
  const names = (months: ReturnType<typeof toSeasonRaceMonths>) =>
    months.flatMap((month) => month.races).map((race) => race.name);

  const season2026 = toSeasonRaceMonths(races, "2026-11-13");
  assert.deepEqual(names(season2026), ["Meia de Berlim", "Meia de Curitiba"]);
  assert.equal(season2026.find((month) => month.label === "MAR")?.races.length, 1);
  assert.equal(season2026[0].races[0].dateKey, "2026-03-29");

  // Na virada do ano a temporada acompanha a data de hoje.
  assert.deepEqual(names(toSeasonRaceMonths(races, "2027-01-02")), ["Meia Maratona do Recife"]);
  // E dá para pedir uma temporada específica.
  assert.deepEqual(names(toSeasonRaceMonths(races, "2027-01-02", 2026)), ["Meia de Berlim", "Meia de Curitiba"]);
});

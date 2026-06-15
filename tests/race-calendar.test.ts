import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MANAGED_RACES,
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

import test from "node:test";
import assert from "node:assert/strict";

import { getCurrentSeasonYear, getSeasonEpochRange, getYearFromDateKey } from "../app/lib/season";

test("ano da temporada respeita o fuso de São Paulo na virada", () => {
  // 01:30 UTC de 1º de janeiro ainda é 31 de dezembro em Brasília.
  assert.equal(getCurrentSeasonYear(new Date("2027-01-01T01:30:00Z")), 2026);
  assert.equal(getCurrentSeasonYear(new Date("2027-01-01T03:30:00Z")), 2027);
});

test("ano vem da chave de data e os limites cobrem o ano inteiro", () => {
  assert.equal(getYearFromDateKey("2027-03-07"), 2027);
  assert.equal(getYearFromDateKey("2026-11-12T18:40:00Z"), 2026);
  assert.equal(getYearFromDateKey("07/03"), null);
  const range = getSeasonEpochRange(2026);
  assert.equal(new Date(range.after * 1000).toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(new Date(range.before * 1000).toISOString(), "2027-01-01T00:00:00.000Z");
});

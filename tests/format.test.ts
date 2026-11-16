import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDateRangeShort,
  formatDayMonth,
  formatDuration,
  formatKm,
  formatLongDate,
  formatNumber,
  formatPace,
  formatPaceFromDistance,
  formatWeekdayShort,
} from "../app/lib/format";

test("números e distâncias saem em pt-BR", () => {
  assert.equal(formatNumber(7131), "7.131");
  assert.equal(formatNumber(1690.4), "1.690");
  assert.equal(formatKm(17.94), "17,9 km");
  assert.equal(formatKm(8.44, 2), "8,44 km");
  assert.equal(formatKm(Number.NaN), "—");
});

test("pace e duração", () => {
  assert.equal(formatPace(329), "5:29/km");
  assert.equal(formatPace(299.6), "5:00/km");
  assert.equal(formatPace(null), "—");
  assert.equal(formatPaceFromDistance(8440, 2703), "5:20/km");
  assert.equal(formatDuration(2703), "45:03");
  assert.equal(formatDuration(3829), "1:03:49");
});

test("datas a partir da chave não dependem do fuso do servidor", () => {
  assert.equal(formatWeekdayShort("2026-11-12"), "qui");
  assert.equal(formatDayMonth("2026-11-12"), "12 nov");
  assert.equal(formatLongDate("2026-11-13"), "sexta, 13 de novembro");
  assert.equal(formatLongDate("2026-11-15"), "domingo, 15 de novembro");
});

test("faixa curta da semana", () => {
  assert.equal(formatDateRangeShort("2026-11-09", "2026-11-15"), "9–15 nov");
  assert.equal(formatDateRangeShort("2026-09-28", "2026-10-04"), "28 set – 4 out");
});

import test from "node:test";
import assert from "node:assert/strict";

import { STRAVA_CACHE_WINDOW_SECONDS, ceilToHour, floorToHour, getStravaCacheWindow } from "../app/lib/strava-client";

test("janela de cache do Strava muda a cada intervalo e fica estável dentro dele", () => {
  const start = 1_800_000_000_000 - (1_800_000_000_000 % (STRAVA_CACHE_WINDOW_SECONDS * 1000));
  const window = getStravaCacheWindow(start);
  assert.equal(getStravaCacheWindow(start + (STRAVA_CACHE_WINDOW_SECONDS - 1) * 1000), window);
  assert.equal(getStravaCacheWindow(start + STRAVA_CACHE_WINDOW_SECONDS * 1000), window + 1);
});

test("limites de busca arredondam para a hora cheia sem estreitar o intervalo", () => {
  const exact = Date.UTC(2026, 0, 1) / 1000;
  assert.equal(floorToHour(exact), exact);
  assert.equal(ceilToHour(exact), exact);
  assert.equal(floorToHour(exact + 1799), exact);
  assert.equal(floorToHour(exact + 3599), exact);
  assert.equal(ceilToHour(exact + 1), exact + 3600);
});

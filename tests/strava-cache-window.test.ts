import test from "node:test";
import assert from "node:assert/strict";

import { STRAVA_CACHE_WINDOW_SECONDS, getStravaCacheWindow } from "../app/lib/strava-client";

test("janela de cache do Strava muda a cada intervalo e fica estável dentro dele", () => {
  const start = 1_800_000_000_000 - (1_800_000_000_000 % (STRAVA_CACHE_WINDOW_SECONDS * 1000));
  const window = getStravaCacheWindow(start);
  assert.equal(getStravaCacheWindow(start + (STRAVA_CACHE_WINDOW_SECONDS - 1) * 1000), window);
  assert.equal(getStravaCacheWindow(start + STRAVA_CACHE_WINDOW_SECONDS * 1000), window + 1);
});

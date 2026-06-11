import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MANUAL_PREDICTIONS, MANUAL_PREDICTIONS_KEY } from "../app/lib/manual-predictions";

test("manual predictions usa chave estável no Upstash", () => {
  assert.equal(MANUAL_PREDICTIONS_KEY, "manual-predictions:latest");
});

test("manual predictions mantém fallback em HH:MM:SS", () => {
  assert.match(DEFAULT_MANUAL_PREDICTIONS.stravaMarathonPrediction, /^\d{2}:\d{2}:\d{2}$/);
});

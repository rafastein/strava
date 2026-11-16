import test from "node:test";
import assert from "node:assert/strict";

import { getBestHalfIndex, getHalfRacePace } from "../app/lib/half-marathon";

const flat = (pace: number) => Array.from({ length: 21 }, () => ({ paceSecPerKm: pace }));

test("pace da meia vem do tempo da prova, não da média dos splits", () => {
  assert.equal(Math.round(getHalfRacePace({ timeSec: 5711, distanceKm: 21.15, splits: flat(330) })), 270);
  assert.equal(getHalfRacePace({ timeSec: null, distanceKm: 21.1, splits: flat(300) }), 300);
});

test("melhor meia é uma só, mesmo com splits iguais", () => {
  const races = [
    { timeSec: 8903, distanceKm: 21.1, splits: flat(330) },
    { timeSec: 5711, distanceKm: 21.15, splits: flat(330) },
    { timeSec: 5909, distanceKm: 21.2, splits: flat(330) },
  ];
  assert.equal(getBestHalfIndex(races), 1);
  assert.equal(getBestHalfIndex([]), -1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { aggregateVdot, calculateVdot, pacesFromVdot, trainingPacesFromVdot } from "../app/lib/vdot";

test("calculateVdot estima VDOT coerente para meia em 1:38:09", () => {
  const vdot = calculateVdot(21_097, 1 * 3600 + 38 * 60 + 9);
  assert.ok(vdot !== null);
  assert.ok(vdot >= 46 && vdot <= 47, `VDOT calculado: ${vdot}`);
});

test("calculateVdot rejeita entradas inválidas", () => {
  assert.equal(calculateVdot(0, 3600), null);
  assert.equal(calculateVdot(5000, 0), null);
  assert.equal(calculateVdot(5000, -1), null);
});

test("aggregateVdot usa média ponderada e ignora valores inválidos", () => {
  assert.equal(
    aggregateVdot([
      { vdot: 45, weight: 1 },
      { vdot: 50, weight: 3 },
      { vdot: 0, weight: 99 },
    ]),
    48.8,
  );
});

test("pacesFromVdot e trainingPacesFromVdot retornam paces em ordem plausível", () => {
  const race = pacesFromVdot(46);
  const training = trainingPacesFromVdot(46);

  assert.ok(race.km5 < race.km10);
  assert.ok(race.km10 < race.half);
  assert.ok(race.half < race.marathon);
  assert.ok(training.easy.min < training.easy.max);
  assert.ok(training.threshold.min < training.threshold.max);
  assert.ok(training.interval < training.easy.min);
});

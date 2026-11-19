import assert from "node:assert/strict";
import test from "node:test";

import { getCorosSyncRange, looksLikeCorosSchedule, syncCorosSchedule } from "../app/lib/coros-sync";
import type { StructuredPlannedWorkout, StructuredPlannedWorkoutRangeResult } from "../app/lib/planned-workout";

// Formato da resposta de queryTrainingSchedule (IDs trocados).
const SCHEDULE = `Training Schedule
========================

2026-11-17
17/11 Ter - Corrida Longo 8,50 Km
Plan ID: 1
idInPlan: 1
Distance: 8.50 km
Estimated Time: 48:53
Load: 73 TL

2026-11-19
19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km
Plan ID: 1
idInPlan: 2
Distance: 9.97 km
Estimated Time: 57:00
Load: 86 TL

2026-11-22
22/11 Dom - Corrida Continuo
Plan ID: 1
idInPlan: 3
Distance: 15.58 km
Estimated Time: 1:20:00
Load: 160 TL

Use Plan ID with queryTrainingPlanDetails before updateTrainingPlan. Do not show Plan ID or idInPlan to the user.`;

function saved(date: string, source: StructuredPlannedWorkout["source"]): StructuredPlannedWorkoutRangeResult {
  return {
    date,
    key: `planned-workout:${date}`,
    source: "redis",
    sourceLabel: "Upstash",
    redisConfigured: true,
    data: { date, source, title: "x", type: "rodagem", distanceKm: 5, durationMin: 30, steps: [], importedAt: "" },
  };
}

test("janela vai de duas segundas atrás até cinco semanas à frente", () => {
  assert.deepEqual(getCorosSyncRange("2026-11-19"), { start: "2026-11-02", end: "2026-12-24" });
  assert.deepEqual(getCorosSyncRange("2026-11-16"), { start: "2026-11-02", end: "2026-12-21" });
});

test("sincronização grava a agenda, apaga o que sumiu do COROS e preserva o resto", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const savedWorkouts: StructuredPlannedWorkout[] = [];
  const removed: string[] = [];

  const result = await syncCorosSchedule("2026-11-19", {
    callTool: async (name, args) => {
      calls.push([name, args]);
      return SCHEDULE;
    },
    save: async (workout) => savedWorkouts.push(workout),
    listSaved: async () => [
      saved("2026-11-17", "coros"), // continua no COROS
      saved("2026-11-18", "coros"), // apagado no COROS → sai
      saved("2026-11-20", "manual"), // manual → fica
      saved("2026-10-01", "coros"), // fora da janela → fica
    ],
    remove: async (date) => removed.push(date),
  });

  assert.deepEqual(calls, [["queryTrainingSchedule", { startDate: "20261102", endDate: "20261224" }]]);
  assert.deepEqual(savedWorkouts.map((w) => [w.date, w.distanceKm, w.source]), [
    ["2026-11-17", 8.5, "coros"],
    ["2026-11-19", 9.97, "coros"],
    ["2026-11-22", 15.58, "coros"],
  ]);
  assert.equal(savedWorkouts[2].durationMin, 80);
  assert.deepEqual(removed, ["2026-11-18"]);
  assert.deepEqual(result, { range: { start: "2026-11-02", end: "2026-12-24" }, saved: 3, removed: 1 });
});

test("resposta estranha do COROS não apaga nada", async () => {
  let removedSomething = false;
  await assert.rejects(
    syncCorosSchedule("2026-11-19", {
      callTool: async () => "Unauthorized",
      save: async () => undefined,
      listSaved: async () => [saved("2026-11-18", "coros")],
      remove: async () => {
        removedSomething = true;
      },
    }),
    /Resposta inesperada/,
  );
  assert.equal(removedSomething, false);
  assert.equal(looksLikeCorosSchedule("Training Schedule\n===\n"), true);
});

test("agenda vazia apaga os treinos do COROS da janela", async () => {
  const removed: string[] = [];
  const result = await syncCorosSchedule("2026-11-19", {
    callTool: async () => "Training Schedule\n========================\n\nNo workouts scheduled.",
    save: async () => undefined,
    listSaved: async () => [saved("2026-11-20", "coros")],
    remove: async (date) => removed.push(date),
  });
  assert.deepEqual(removed, ["2026-11-20"]);
  assert.equal(result.saved, 0);
});

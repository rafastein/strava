import assert from "node:assert/strict";
import test from "node:test";

import { applyCourseDetail, syncCorosSchedule } from "../app/lib/coros-sync";
import {
  extractCorosCourses,
  findCourseForWorkout,
  parseAmount,
  parseCorosCourseDescription,
  splitIntoWindows,
} from "../app/lib/coros-workout-details";
import { normalizeStructuredWorkout, type StructuredPlannedWorkout } from "../app/lib/planned-workout";

// Descrição real de um fartlek, como o COROS devolve (IDs trocados).
const FARTLEK =
  "1. Aquecer por 10min - Intensidade Z1 - Leve (Pace: 05:44 a 07:22 min/km | Velocidade: 8,14 a 10,47 km/h)\r\n\r\n" +
  "2.  Repetir 3x\r\n" +
  "- Correr por 5min - Intensidade Z2 - Leve/Moderada (Pace: 04:32 a 05:44 min/km | Velocidade: 10,47 a 13,23 km/h)\r\n" +
  "- Correr por 2min - Intensidade Z1 - Leve (Pace: 05:44 a 07:22 min/km | Velocidade: 8,14 a 10,47 km/h)\r\n\r\n" +
  "3. Desaquecer por 5min - Intensidade Z1 - Leve (Pace: 05:44 a 07:22 min/km | Velocidade: 8,14 a 10,47 km/h)\r\n\r\n\r\n\r\n" +
  "Treino leve em razao da prova\nRegenerativo\r\n\r\n" +
  "---Detalhes do Treino---\r\nModalidade: Corrida\r\nTipo: Fartlek\r\nPercurso: Ligeira inclinacao\r\nDistancia: 8.898 Km\r\nTempo Minimo: 57:00\r\n( | ) \r\n";

const PLAN_DETAILS = [
  "Training Plan Detail",
  "========================",
  "Days (dayNo 865-866)",
  "------------------------",
  "Day 865 - 2026-11-19",
  "Course 1 [Completed, score 100.0]",
  "Course: 19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km",
  `Course JSON: ${JSON.stringify({ dayNo: 865, courseName: "19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km", courseDescription: FARTLEK, sportType: 1, sections: [] })}`,
  "  Degradation: Absolute pace values cannot be represented as whole seconds per kilometer.",
  "Day 866 - 2026-11-20",
  "Course 1 [Not started, score -1.0]",
  `Course JSON: ${JSON.stringify({ courseName: "20/11 Sex - Corrida Continuo 5,00 Km", courseDescription: "1. Correr por 5km - Intensidade Z2 - Leve/Moderada (Pace: 04:32 a 05:44 min/km)\r\n\r\n---Detalhes do Treino---\r\nPercurso: Cross\r\n" })}`,
].join("\n");

test("quantidades em português viram minutos ou km", () => {
  assert.deepEqual(parseAmount("10min"), { durationMin: 10, distanceKm: null });
  assert.deepEqual(parseAmount("1h20"), { durationMin: 80, distanceKm: null });
  assert.deepEqual(parseAmount("1h"), { durationMin: 60, distanceKm: null });
  assert.deepEqual(parseAmount("5km"), { durationMin: null, distanceKm: 5 });
  assert.deepEqual(parseAmount("400m"), { durationMin: null, distanceKm: 0.4 });
  assert.deepEqual(parseAmount("30s"), { durationMin: 0.5, distanceKm: null });
});

test("descrição da assessoria vira aquecimento, bloco repetido, desaquecimento e observação", () => {
  const detail = parseCorosCourseDescription(FARTLEK);

  assert.equal(detail.route, "Ligeira inclinacao");
  assert.equal(detail.notes, "Treino leve em razao da prova\nRegenerativo");
  assert.equal(detail.steps.length, 3);

  const [warmup, repeat, cooldown] = detail.steps;
  assert.deepEqual(warmup, {
    label: "Aquecer por 10min",
    repeat: null,
    distanceKm: null,
    durationMin: 10,
    intensity: "Z1 leve",
    target: "05:44–07:22/km",
    kind: "aquecimento",
  });

  assert.equal(repeat.label, "Repetir 3×");
  assert.equal(repeat.repeat, 3);
  assert.deepEqual(repeat.children?.map((step) => [step.label, step.durationMin, step.intensity, step.kind]), [
    ["Correr por 5min", 5, "Z2 leve/moderada", "bloco"],
    ["Correr por 2min", 2, "Z1 leve", "recuperacao"],
  ]);

  assert.equal(cooldown.kind, "desaquecimento");
  assert.equal(cooldown.durationMin, 5);
});

test("detalhes do plano: cada curso com a sua data", () => {
  const courses = extractCorosCourses(PLAN_DETAILS);
  assert.deepEqual(courses.map((course) => [course.date, course.name]), [
    ["2026-11-19", "19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km"],
    ["2026-11-20", "20/11 Sex - Corrida Continuo 5,00 Km"],
  ]);
  assert.equal(findCourseForWorkout(courses, "2026-11-20", "outro nome")?.name, "20/11 Sex - Corrida Continuo 5,00 Km");
  assert.equal(findCourseForWorkout(courses, "2026-11-21", "x"), null);
});

test("observação com a palavra prova não transforma o fartlek em prova", () => {
  const base = normalizeStructuredWorkout({
    date: "2026-11-19",
    source: "coros",
    title: "19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km",
    distanceKm: 9.97,
  });
  const [course] = extractCorosCourses(PLAN_DETAILS);
  const enriched = normalizeStructuredWorkout(applyCourseDetail(base, course) as StructuredPlannedWorkout);

  assert.equal(enriched.type, "fartlek");
  assert.equal(enriched.route, "Ligeira inclinacao");
  assert.equal(enriched.description, "Treino leve em razao da prova\nRegenerativo");
  // O bloco repetido sobrevive à normalização de quando o treino é lido do Redis.
  assert.equal(enriched.steps[1].children?.length, 2);
});

test("janelas de 28 dias cobrem o intervalo inteiro", () => {
  assert.deepEqual(splitIntoWindows("2026-11-02", "2026-12-24"), [
    { start: "2026-11-02", end: "2026-11-29" },
    { start: "2026-11-30", end: "2026-12-24" },
  ]);
  assert.deepEqual(splitIntoWindows("2026-11-02", "2026-11-05"), [{ start: "2026-11-02", end: "2026-11-05" }]);
});

test("sincronização grava os treinos com as etapas; falha no detalhe não derruba a agenda", async () => {
  const schedule = [
    "Training Schedule",
    "========================",
    "",
    "2026-11-19",
    "19/11 Qui - Corrida Fartlek 8,90 - 11,33 Km",
    "Plan ID: 7",
    "idInPlan: 333",
    "Distance: 9.97 km",
    "",
    "2026-11-21",
    "Treino avulso",
    "idInPlan: 900",
    "Distance: 6.00 km",
  ].join("\n");

  const saved: StructuredPlannedWorkout[] = [];
  const result = await syncCorosSchedule("2026-11-19", {
    callTool: async (name) => {
      if (name === "queryTrainingSchedule") return JSON.stringify(schedule);
      if (name === "queryTrainingPlanDetails") return JSON.stringify(PLAN_DETAILS);
      throw new Error("falhou");
    },
    save: async (workout) => saved.push(workout),
    listSaved: async () => [],
    remove: async () => undefined,
  });

  assert.equal(result.saved, 2);
  assert.equal(result.detailed, 1);
  assert.equal(result.detailErrors, 1); // o avulso falhou
  assert.equal(saved[0].steps.length, 3);
  assert.equal(saved[0].type, "fartlek");
  assert.equal(saved[1].steps.length, 0);
});

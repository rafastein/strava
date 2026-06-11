import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSisrunWorkbook } from "../app/lib/sisrun-xls-parser";

test("parseSisrunWorkbook transforma planilha em linhas e semanas", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    {
      Data: "01/07/2026",
      "Treinos propostos": 1,
      "Treinos feitos": 0,
      "Distância proposta": 10,
      "Distância feita": 0,
      "Tempo mínimo proposto": "00:50:00",
      "Tempo máximo proposto": "01:00:00",
    },
    {
      Data: "05/07/2026",
      "Treinos propostos": 1,
      "Treinos feitos": 0,
      "Distância proposta": 24,
      "Distância feita": 0,
    },
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, "Planilha");

  const parsed = parseSisrunWorkbook(workbook, "teste.xls");

  assert.equal(parsed.fileName, "teste.xls");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.weeks.length, 1);
  assert.equal(parsed.weeks[0].totalPlannedKm, 34);
  assert.equal(parsed.weeks[0].longRunPlannedKm, 24);
  assert.equal(parsed.weeks[0].workoutCount, 2);
});


test("parseSisrunWorkbook aceita nomes alternativos e preserva detalhes do treino", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    {
      Data: "11/06/2026",
      "Treinos planejados": 1,
      "KM planejado": 9,
      "Tipo de treino": "Intervalado",
      Intensidade: "Z2/Z1",
      Percurso: "Pista",
      "Descrição do treino": "2 km Z1 + 7x 500m Z2 / 500m Z1",
      "Tempo mínimo planejado": "00:47:24",
      "Tempo máximo planejado": "01:00:36",
    },
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, "Planilha");

  const parsed = parseSisrunWorkbook(workbook, "detalhado.xls");
  const workout = parsed.weeks[0].workouts?.[0];

  assert.equal(parsed.rows[0].plannedDistanceKm, 9);
  assert.equal(workout?.workoutType, "Intervalado");
  assert.equal(workout?.intensity, "Z2/Z1");
  assert.equal(workout?.routeType, "Pista");
  assert.equal(workout?.description, "2 km Z1 + 7x 500m Z2 / 500m Z1");
});

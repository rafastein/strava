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

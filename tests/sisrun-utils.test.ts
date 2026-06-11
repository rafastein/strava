import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSisrunStatusSummary,
  getSisrunDataQualityWarnings,
  parseBrDate,
  SISRUN_KEY,
  type SisrunDataResult,
  type SisrunParsedData,
} from "../app/lib/sisrun-utils";

const sampleSisrunData: SisrunParsedData = {
  athleteName: "Rafael",
  uploadedAt: "2020-01-01T12:00:00.000Z",
  fileName: "planilha_teste.xls",
  rows: [
    {
      date: "01/07/2026",
      plannedDistanceKm: 10,
      completedDistanceKm: 0,
      minPlannedTime: null,
      maxPlannedTime: null,
    },
    {
      date: "05/07/2026",
      plannedDistanceKm: 100,
      completedDistanceKm: 0,
      minPlannedTime: null,
      maxPlannedTime: null,
    },
  ],
  weeks: [
    {
      weekStart: "29/06/2026",
      weekEnd: "05/07/2026",
      totalPlannedKm: 110,
      longRunPlannedKm: 100,
      workoutCount: 2,
    },
  ],
};

test("parseBrDate interpreta datas brasileiras", () => {
  const date = parseBrDate("05/07/2026");
  assert.ok(date);
  assert.equal(date?.getFullYear(), 2026);
  assert.equal(date?.getMonth(), 6);
  assert.equal(date?.getDate(), 5);
  assert.equal(parseBrDate("2026-07-05"), null);
});

test("getSisrunDataQualityWarnings aponta planilha antiga e volume suspeito", () => {
  const warnings = getSisrunDataQualityWarnings(sampleSisrunData);
  assert.ok(warnings.some((warning) => warning.title === "Planilha possivelmente desatualizada"));
  assert.ok(warnings.some((warning) => warning.title === "Volume planejado suspeito" && warning.level === "error"));
});

test("buildSisrunStatusSummary resume fonte, chave e contagens do SisRUN", () => {
  const result: SisrunDataResult = {
    data: sampleSisrunData,
    source: "redis",
    sourceLabel: "Redis / Upstash",
    redisConfigured: true,
    key: SISRUN_KEY,
    filePath: "/fake/data/sisrun-latest.json",
  };

  const warnings = getSisrunDataQualityWarnings(sampleSisrunData);
  const status = buildSisrunStatusSummary(result, warnings);

  assert.equal(status.source, "redis");
  assert.equal(status.key, "sisrun:latest");
  assert.equal(status.fileName, "planilha_teste.xls");
  assert.equal(status.weeksCount, 1);
  assert.equal(status.rowsCount, 2);
  assert.equal(status.workoutCount, 2);
  assert.equal(status.totalPlannedKm, 110);
  assert.equal(status.warningsCount, warnings.length);
});

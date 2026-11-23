import test from "node:test";
import assert from "node:assert/strict";
import {
  calcActivityLoad,
  calcTrainingLoad,
  classifyStatus,
  describeTsb,
  hrTSSFromHR,
} from "../app/lib/training-load";

// FC do Rafael: repouso 54, máxima 184, limiar 165.
const HR = { hrMax: 184, hrRest: 54, lthr: 165 };

function run(date: string, minutes: number, hr: number | null, km = minutes / 5.5) {
  return {
    id: Math.round(Math.random() * 1e9),
    type: "Run",
    sport_type: "Run",
    start_date_local: `${date}T07:00:00`,
    moving_time: minutes * 60,
    distance: km * 1000,
    average_heartrate: hr,
  };
}

test("hrTSS: 1 hora na FC de limiar vale 100, como no TSS", () => {
  assert.equal(Math.round(hrTSSFromHR(3600, 165, 184, 54, 165)), 100);
  assert.equal(Math.round(hrTSSFromHR(1800, 165, 184, 54, 165)), 50);
  // Rodagem de 60 min a 140 bpm ≈ 54 pontos (antes eram ≈ 91 de TRIMP).
  assert.equal(Math.round(calcActivityLoad(run("2026-11-20", 60, 140), HR)), 54);
});

test("com e sem FC a carga fica na mesma escala", () => {
  // 1 hora exatamente no pace de limiar, sem FC → 100 de rTSS.
  const noHr = calcActivityLoad(
    { ...run("2026-11-20", 60, null), distance: (3600 / 255) * 1000 },
    { ...HR, thresholdPaceSecPerKm: 255 },
  );
  assert.equal(Math.round(noHr), 100);
  assert.equal(Math.round(calcActivityLoad(run("2026-11-20", 60, 165), HR)), 100);
});

test("sem FC de limiar informada, estima 85% da reserva", () => {
  const estimated = calcActivityLoad(run("2026-11-20", 60, 165), { hrMax: 184, hrRest: 54 });
  // 54 + 0,85 × 130 = 164,5 → 165: quase o mesmo valor.
  assert.ok(Math.abs(estimated - 100) < 2);
});

test("TrailRun conta; bike não", () => {
  assert.ok(calcActivityLoad({ ...run("2026-11-20", 60, 150), type: "TrailRun", sport_type: "TrailRun" }, HR) > 0);
  assert.equal(calcActivityLoad({ ...run("2026-11-20", 60, 150), type: "Ride", sport_type: "Ride" }, HR), 0);
});

test("faixas da carga aguda/crônica seguem Gabbett (0,8 / 1,3 / 1,5)", () => {
  assert.equal(classifyStatus(0.5), "low");
  assert.equal(classifyStatus(0.79), "low");
  assert.equal(classifyStatus(0.8), "productive");
  assert.equal(classifyStatus(1.3), "productive");
  assert.equal(classifyStatus(1.4), "caution");
  assert.equal(classifyStatus(1.5), "spike");
});

test("faixas do frescor", () => {
  assert.equal(describeTsb(30).label, "Muito descansado");
  assert.equal(describeTsb(12).label, "Pronto para prova");
  assert.equal(describeTsb(0).label, "Transição");
  assert.equal(describeTsb(-20).label, "Em bloco de treino");
  assert.equal(describeTsb(-35).label, "Fadiga alta");
});

test("frescor do dia usa o fim do dia anterior: o treino de hoje só pesa amanhã", () => {
  const days = calcTrainingLoad([run("2026-06-09", 60, 150), run("2026-06-10", 90, 160)], {
    ...HR,
    today: "2026-06-11",
    displayDays: 3,
    warmupDays: 30,
  });

  assert.deepEqual(days.map((d) => d.date), ["2026-06-09", "2026-06-10", "2026-06-11"]);
  const [d9, d10, d11] = days;
  assert.equal(d9.tsb, 0); // nada antes
  assert.equal(d10.tsb, Math.round((d9.ctl - d9.atl) * 10) / 10);
  assert.equal(d11.tsb, Math.round((d10.ctl - d10.atl) * 10) / 10);
  assert.ok(d11.load === 0 && d10.load > d9.load);
});

test("série respeita displayDays e aquece a forma antes da janela", () => {
  const days = calcTrainingLoad([run("2026-06-06", 60, 145), run("2026-06-08", 60, 150)], {
    ...HR,
    today: "2026-06-10",
    displayDays: 3,
    warmupDays: 5,
    thresholdPaceSecPerKm: 260,
  });

  assert.deepEqual(days.map((d) => d.date), ["2026-06-08", "2026-06-09", "2026-06-10"]);
  assert.ok(days[0].load > 0);
  assert.ok(days[0].ctl > 0);
  assert.ok(days[2].ctl > 0);
});

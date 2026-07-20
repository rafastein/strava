import assert from "node:assert/strict";
import test from "node:test";
import {
  formatEquipmentAge,
  formatEquipmentPrice,
  formatEquipmentPurchaseDate,
  formatEstimatedPricePerKm,
  formatEstimatedRuns,
  formatPricePerKm,
  formatPricePerRun,
  getEquipmentPurchaseMetadata,
} from "../app/lib/equipment-metadata";

test("encontra preço e data pelo nome do tênis", () => {
  assert.deepEqual(getEquipmentPurchaseMetadata("Fila Skytrail"), {
    priceBRL: 331.19,
    purchaseDate: "2025-03-17",
  });

  assert.deepEqual(
    getEquipmentPurchaseMetadata("ASICS Magic Speed 5 - Branco"),
    {
      priceBRL: 764.99,
      purchaseDate: "2026-06-18",
    },
  );

  assert.deepEqual(
    getEquipmentPurchaseMetadata("Saucony Endorphin Pro 4"),
    {
      priceBRL: 1083.59,
      purchaseDate: "2026-05-23",
    },
  );
});

test("calcula preço por km com a quilometragem filtrada do equipamento", () => {
  assert.equal(formatPricePerKm(331.19, 19.97), "R$ 16,58/km");
  assert.equal(formatPricePerKm(331.19, 0), "Ainda sem uso");
  assert.equal(formatPricePerKm(undefined, 20), "Não informado");
});

test("calcula preço por corrida com a quantidade filtrada de atividades", () => {
  assert.equal(formatPricePerRun(729.4, 62), "R$ 11,76");
  assert.equal(formatPricePerRun(331.19, 3), "R$ 110,40");
  assert.equal(formatPricePerRun(331.19, 0), "Ainda sem uso");
  assert.equal(formatPricePerRun(undefined, 3), "Não informado");
});

test("formata preço e data da compra", () => {
  assert.equal(formatEquipmentPrice(729.4), "R$ 729,40");
  assert.equal(formatEquipmentPrice(undefined), "Não informado");
  assert.equal(formatEquipmentPurchaseDate("2025-02-07"), "07/02/2025");
  assert.equal(formatEquipmentPurchaseDate(undefined), "Não informada");
  assert.equal(formatEquipmentPurchaseDate("2025-99-99"), "Não informada");
});

test("calcula preço estimado por km pela vida útil cadastrada", () => {
  assert.equal(formatEstimatedPricePerKm(729.4, 800), "R$ 0,91/km");
  assert.equal(formatEstimatedPricePerKm(1224.18, 500), "R$ 2,45/km");
  assert.equal(formatEstimatedPricePerKm(undefined, 500), "Não informado");
  assert.equal(formatEstimatedPricePerKm(729.4, 0), "Não estimado");
});


test("estima a quantidade de corridas pela distância média e vida útil", () => {
  assert.equal(formatEstimatedRuns(800, 7.5), "107 corridas");
  assert.equal(formatEstimatedRuns(500, 13.3), "38 corridas");
  assert.equal(formatEstimatedRuns(10, 10), "1 corrida");
  assert.equal(formatEstimatedRuns(800, 0), "Não estimado");
  assert.equal(formatEstimatedRuns(0, 7.5), "Não estimado");
});

test("formata a idade em anos e meses completos", () => {
  const referenceDate = new Date("2026-07-17T15:00:00.000Z");

  assert.equal(
    formatEquipmentAge("2025-03-17", referenceDate),
    "1 ano e 4 meses",
  );
  assert.equal(formatEquipmentAge("2025-07-01", referenceDate), "1 ano");
  assert.equal(formatEquipmentAge("2025-12-20", referenceDate), "6 meses");
  assert.equal(
    formatEquipmentAge("2026-06-18", referenceDate),
    "Menos de 1 mês",
  );
  assert.equal(formatEquipmentAge(undefined, referenceDate), "Não informada");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  formatEquipmentAge,
  formatPricePerKm,
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
});

test("calcula preço por km com a quilometragem filtrada do equipamento", () => {
  assert.equal(formatPricePerKm(331.19, 19.97), "R$ 16,58/km");
  assert.equal(formatPricePerKm(331.19, 0), "Ainda sem uso");
  assert.equal(formatPricePerKm(undefined, 20), "Não informado");
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

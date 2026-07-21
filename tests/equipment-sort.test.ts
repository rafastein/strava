import assert from "node:assert/strict";
import test from "node:test";
import { sortEquipmentByName } from "../app/lib/equipment-sort";

test("ordena os equipamentos alfabeticamente pelo nome exibido", () => {
  const sorted = sortEquipmentByName([
    { name: "PUMA Deviate Nitro 3" },
    { name: "ASICS Superblast 2" },
    { name: "361 Flame RS" },
    { name: "Adidas Adios Pro 4" },
    { name: "ASICS Novablast 4" },
    { name: "Saucony Endorphin Pro 4" },
  ]);

  assert.deepEqual(
    sorted.map((equipment) => equipment.name),
    [
      "361 Flame RS",
      "Adidas Adios Pro 4",
      "ASICS Novablast 4",
      "ASICS Superblast 2",
      "PUMA Deviate Nitro 3",
      "Saucony Endorphin Pro 4",
    ],
  );
});

test("não altera a lista original ao ordenar", () => {
  const original = [{ name: "PUMA" }, { name: "Adidas" }];

  sortEquipmentByName(original);

  assert.deepEqual(original.map((equipment) => equipment.name), ["PUMA", "Adidas"]);
});

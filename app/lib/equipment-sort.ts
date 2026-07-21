export function compareEquipmentNames(firstName: string, secondName: string) {
  return firstName.localeCompare(secondName, "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortEquipmentByName<T extends { name: string }>(items: readonly T[]) {
  return [...items].sort((first, second) =>
    compareEquipmentNames(first.name, second.name),
  );
}

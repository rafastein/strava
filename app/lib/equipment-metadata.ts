export type EquipmentPurchaseMetadata = {
  priceBRL: number;
  purchaseDate: string;
};

const EQUIPMENT_PURCHASES: Record<string, EquipmentPurchaseMetadata> = {
  "asics novablast 4": {
    priceBRL: 729.4,
    purchaseDate: "2025-02-07",
  },
  "puma deviate nitro 3": {
    priceBRL: 878.64,
    purchaseDate: "2025-05-20",
  },
  "on cloudsurfer next": {
    priceBRL: 999,
    purchaseDate: "2024-09-17",
  },
  "new balance sc elite": {
    priceBRL: 869.42,
    purchaseDate: "2025-08-28",
  },
  "adidas boston 12": {
    priceBRL: 854.99,
    purchaseDate: "2025-03-12",
  },
  "adidas evo sl": {
    priceBRL: 1099.99,
    purchaseDate: "2025-07-01",
  },
  "asics superblast 2": {
    priceBRL: 1151.53,
    purchaseDate: "2025-12-20",
  },
  "adidas adios pro 4": {
    priceBRL: 1224.18,
    purchaseDate: "2026-03-03",
  },
  "361 flame rs": {
    priceBRL: 539.1,
    purchaseDate: "2025-04-02",
  },
  "fila skytrail": {
    priceBRL: 331.19,
    purchaseDate: "2025-03-17",
  },
  "asics magic speed 5": {
    priceBRL: 764.99,
    purchaseDate: "2026-06-18",
  },
};

function normalizeEquipmentName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getEquipmentPurchaseMetadata(
  shoeName: string,
): EquipmentPurchaseMetadata | null {
  const normalizedName = normalizeEquipmentName(shoeName);
  const exactMatch = EQUIPMENT_PURCHASES[normalizedName];
  if (exactMatch) return exactMatch;

  // O Strava pode acrescentar cor ou observações ao nome do equipamento.
  // Mantemos o cadastro reconhecível sem depender do nome ser idêntico.
  const partialMatch = Object.entries(EQUIPMENT_PURCHASES).find(
    ([knownName]) =>
      normalizedName.startsWith(`${knownName} `) ||
      normalizedName.endsWith(` ${knownName}`),
  );

  return partialMatch?.[1] ?? null;
}

export function formatPricePerKm(
  priceBRL: number | null | undefined,
  totalKm: number,
) {
  if (typeof priceBRL !== "number" || !Number.isFinite(priceBRL)) {
    return "Não informado";
  }

  if (!Number.isFinite(totalKm) || totalKm <= 0) {
    return "Ainda sem uso";
  }

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(priceBRL / totalKm)
    .replace(/\u00a0/g, " ");

  return `${formattedPrice}/km`;
}

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function parseDateOnly(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getCalendarDateInBrazil(referenceDate: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatEquipmentAge(
  purchaseDate: string | null | undefined,
  referenceDate: Date = new Date(),
) {
  if (!purchaseDate) return "Não informada";

  const purchase = parseDateOnly(purchaseDate);
  if (!purchase) return "Não informada";

  const reference = getCalendarDateInBrazil(referenceDate);
  let completedMonths =
    (reference.year - purchase.year) * 12 +
    (reference.month - purchase.month);

  if (reference.day < purchase.day) {
    completedMonths -= 1;
  }

  if (completedMonths < 1) {
    return "Menos de 1 mês";
  }

  const years = Math.floor(completedMonths / 12);
  const months = completedMonths % 12;

  if (years === 0) {
    return pluralize(months, "mês", "meses");
  }

  if (months === 0) {
    return pluralize(years, "ano", "anos");
  }

  return `${pluralize(years, "ano", "anos")} e ${pluralize(months, "mês", "meses")}`;
}

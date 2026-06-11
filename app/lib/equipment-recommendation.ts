import type { SisrunParsedData, SisrunRow, SisrunWorkout } from "./sisrun-utils";

export type EquipmentWorkoutType =
  | "regenerativo"
  | "rodagem"
  | "intervalado"
  | "fartlek"
  | "ritmo"
  | "longao"
  | "trail"
  | "prova_curta"
  | "prova_longa";

export type EquipmentWorkoutStatus = "planned" | "rest" | "unknown";

export type EquipmentWorkout = {
  status: EquipmentWorkoutStatus;
  type: EquipmentWorkoutType | null;
  label: string;
  dateLabel: string;
  distanceKm: number | null;
  source: "sisrun-workout" | "sisrun-row" | "none";
  evidence: string[];
  plannedWorkout?: SisrunWorkout | null;
  sisrunRow?: SisrunRow | null;
};

export type ShoeProfile = {
  key: string;
  label: string;
  match: string[];
  brand: string;
  maxKm: number;
  strengths: EquipmentWorkoutType[];
  secondary?: EquipmentWorkoutType[];
  raceOnly?: boolean;
  notes: string;
};

export type GearForRecommendation = {
  gearId?: string;
  name: string;
  brand: string;
  totalKm: number;
  maxKm: number;
  activities?: number;
  lastUse?: string;
};

export type ShoeRecommendation = GearForRecommendation & {
  recommendationScore: number;
  profile: ShoeProfile;
  reasons: string[];
};

export const KNOWN_GEAR_NAME_FALLBACKS: Record<string, string> = {
  g21807495: "ASICS Novablast 4",
  g24261597: "PUMA Deviate Nitro 3",
  g19907684: "On Cloudsurfer Next",
  g25620324: "New Balance SC Elite",
  g22477361: "Adidas Boston 12",
  g24432359: "Adidas Evo SL",
  g27836945: "ASICS Superblast 2",
  g29703820: "Adidas Adios Pro 4",
  g22897245: "361 Flame RS",
  g29162176: "Fila Skytrail",
};

export const EQUIPMENT_RECOMMENDATION_TYPES: EquipmentWorkoutType[] = [
  "regenerativo",
  "rodagem",
  "longao",
  "fartlek",
  "ritmo",
  "intervalado",
  "trail",
  "prova_curta",
  "prova_longa",
];

const GENERIC_PROFILE: ShoeProfile = {
  key: "generico",
  label: "Tênis neutro",
  match: [],
  brand: "outro",
  maxKm: 650,
  strengths: ["rodagem", "regenerativo"],
  secondary: ["longao"],
  notes: "Sem perfil específico cadastrado; entra como opção neutra para rodagens leves.",
};

export const SHOE_MODEL_PROFILES: ShoeProfile[] = [
  {
    key: "asics-novablast-4",
    label: "ASICS Novablast 4",
    match: ["novablast"],
    brand: "asics",
    maxKm: 800,
    strengths: ["rodagem", "regenerativo"],
    secondary: ["longao"],
    notes: "Treino diário confortável, bom para rodagem e dias fáceis.",
  },
  {
    key: "puma-deviate-nitro-3",
    label: "PUMA Deviate Nitro 3",
    match: ["deviate"],
    brand: "puma",
    maxKm: 700,
    strengths: ["intervalado", "fartlek", "ritmo"],
    secondary: ["longao"],
    notes: "Versátil e responsivo, bom para variações de ritmo e treinos fortes.",
  },
  {
    key: "on-cloudsurfer-next",
    label: "On Cloudsurfer Next",
    match: ["cloudsurfer"],
    brand: "on",
    maxKm: 700,
    strengths: ["regenerativo", "rodagem"],
    notes: "Opção mais confortável para regenerativo e dias bem leves.",
  },
  {
    key: "new-balance-sc-elite",
    label: "New Balance SC Elite",
    match: ["sc elite", "supercomp elite"],
    brand: "new balance",
    maxKm: 400,
    strengths: ["prova_curta", "prova_longa"],
    secondary: ["ritmo"],
    raceOnly: true,
    notes: "Tênis de placa reservado para prova ou simulado específico.",
  },
  {
    key: "adidas-boston-12",
    label: "Adidas Boston 12",
    match: ["boston"],
    brand: "adidas",
    maxKm: 700,
    strengths: ["ritmo", "fartlek", "rodagem"],
    secondary: ["intervalado", "longao"],
    notes: "Treinador firme para ritmo, progressivo e rodagem moderada.",
  },
  {
    key: "adidas-evo-sl",
    label: "Adidas Evo SL",
    match: ["evo sl", "evo"],
    brand: "adidas",
    maxKm: 800,
    strengths: ["intervalado", "fartlek"],
    secondary: ["ritmo", "rodagem"],
    notes: "Leve e rápido para pista, tiros e variações curtas.",
  },
  {
    key: "asics-superblast-2",
    label: "ASICS Superblast 2",
    match: ["superblast"],
    brand: "asics",
    maxKm: 800,
    strengths: ["longao", "ritmo", "rodagem"],
    secondary: ["regenerativo", "fartlek"],
    notes: "Alta proteção com resposta, ideal para longões e ritmo controlado.",
  },
  {
    key: "adidas-adios-pro-4",
    label: "Adidas Adios Pro 4",
    match: ["adios pro"],
    brand: "adidas",
    maxKm: 500,
    strengths: ["prova_longa", "prova_curta"],
    secondary: ["ritmo"],
    raceOnly: true,
    notes: "Tênis de prova para meia e maratona; evitar gastar em treino comum.",
  },
  {
    key: "361-flame-rs",
    label: "361 Flame RS",
    match: ["361", "flame"],
    brand: "361",
    maxKm: 700,
    strengths: ["rodagem", "regenerativo"],
    secondary: ["fartlek"],
    notes: "Treino diário/leve com boa durabilidade.",
  },
  {
    key: "fila-skytrail",
    label: "Fila Skytrail",
    match: ["skytrail", "trail"],
    brand: "fila",
    maxKm: 600,
    strengths: ["trail"],
    secondary: ["regenerativo"],
    notes: "Opção específica para trilha ou terreno irregular.",
  },
];

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getTodayBrazilDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const [y, m, d] = parts.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatBrazilDateKey(date = new Date()) {
  return getTodayBrazilDate(date).toLocaleDateString("pt-BR");
}

export function inferBrand(name: string, fallback?: string | null) {
  const normalizedFallback = normalizeText(fallback);
  if (normalizedFallback) return normalizedFallback;

  const lower = normalizeText(name);

  if (lower.includes("adidas")) return "adidas";
  if (lower.includes("puma")) return "puma";
  if (lower.includes("asics")) return "asics";
  if (lower.includes("new balance")) return "new balance";
  if (lower.includes("fila")) return "fila";
  if (lower.includes("361")) return "361";
  if (lower.includes("cloudsurfer") || lower.startsWith("on ")) return "on";

  return name.split(" ")[0] || "outro";
}

export function inferShoeProfile(name: string) {
  const lower = normalizeText(name);
  return (
    SHOE_MODEL_PROFILES.find((profile) =>
      profile.match.some((keyword) => lower.includes(normalizeText(keyword)))
    ) ?? GENERIC_PROFILE
  );
}

export function getShoeMaxKm(name: string, explicitMaxKm?: number | null) {
  if (explicitMaxKm && explicitMaxKm > 0) return explicitMaxKm;
  return inferShoeProfile(name).maxKm;
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function getDistanceFromWorkout(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
) {
  const workoutDistance = plannedWorkout?.plannedDistanceKm;
  if (typeof workoutDistance === "number" && workoutDistance > 0) return workoutDistance;

  const rowDistance = sisrunRow?.plannedDistanceKm;
  if (typeof rowDistance === "number" && rowDistance > 0) return rowDistance;

  return 0;
}

function buildEvidence(
  plannedWorkout: SisrunWorkout | null | undefined,
  sisrunRow: SisrunRow | null | undefined,
) {
  const evidence = [
    plannedWorkout?.workoutType,
    plannedWorkout?.intensity,
    plannedWorkout?.routeType,
    plannedWorkout?.description,
    sisrunRow?.minPlannedTime ? `mín. ${sisrunRow.minPlannedTime}` : null,
    sisrunRow?.maxPlannedTime ? `máx. ${sisrunRow.maxPlannedTime}` : null,
  ].filter(Boolean) as string[];

  return evidence;
}

export function classifyEquipmentWorkout(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
): EquipmentWorkoutType | null {
  const distanceKm = getDistanceFromWorkout(plannedWorkout, sisrunRow);
  const text = normalizeText(
    [
      plannedWorkout?.workoutType,
      plannedWorkout?.intensity,
      plannedWorkout?.routeType,
      plannedWorkout?.description,
    ].join(" ")
  );

  if (!distanceKm || hasAny(text, ["descanso", "off", "sem treino"])) return null;

  if (plannedWorkout?.isRace) {
    return distanceKm <= 10 ? "prova_curta" : "prova_longa";
  }

  if (hasAny(text, ["trilha", "trail", "montanha", "terra"  ])) return "trail";
  if (hasAny(text, ["prova", "race", "competicao", "competição"])) {
    return distanceKm <= 10 ? "prova_curta" : "prova_longa";
  }
  if (hasAny(text, ["longao", "longão", "longo"]) || distanceKm >= 16) return "longao";
  if (hasAny(text, ["fartlek", "variacao", "variação"])) return "fartlek";
  if (hasAny(text, ["interval", "tiro", "repet", "pista", "400", "500", "600", "800", "1000", "z5"])) {
    return "intervalado";
  }
  if (hasAny(text, ["ritmo", "tempo", "limiar", "progressivo", "maratona", "pace", "z3", "z4"])) {
    return "ritmo";
  }
  if (hasAny(text, ["regenerativo", "recuper", "leve", "z1"]) || distanceKm <= 6.5) {
    return "regenerativo";
  }

  return "rodagem";
}

export function getWorkoutLabel(type: EquipmentWorkoutType | null) {
  if (!type) return "Descanso";

  const labels: Record<EquipmentWorkoutType, string> = {
    regenerativo: "Regenerativo",
    rodagem: "Rodagem",
    intervalado: "Intervalado",
    fartlek: "Fartlek",
    ritmo: "Ritmo",
    longao: "Longão",
    trail: "Trail",
    prova_curta: "Prova curta (≤ 10 km)",
    prova_longa: "Prova longa (> 10 km)",
  };

  return labels[type];
}

export function getTodayEquipmentWorkout(
  data: SisrunParsedData | null,
  today = new Date(),
): EquipmentWorkout {
  const dateLabel = formatBrazilDateKey(today);
  const weeks = data?.weeks ?? [];
  const rows = data?.rows ?? [];

  const plannedWorkout =
    weeks
      .flatMap((week) => week.workouts ?? [])
      .find((workout) => workout.dateLabel === dateLabel) ?? null;

  const sisrunRow = rows.find((row) => row.date === dateLabel) ?? null;
  const distanceKm = getDistanceFromWorkout(plannedWorkout, sisrunRow);
  const type = classifyEquipmentWorkout(plannedWorkout, sisrunRow);
  const evidence = buildEvidence(plannedWorkout, sisrunRow);

  if (!plannedWorkout && !sisrunRow) {
    return {
      status: "unknown",
      type: null,
      label: "Sem treino carregado",
      dateLabel,
      distanceKm: null,
      source: "none",
      evidence: [],
      plannedWorkout: null,
      sisrunRow: null,
    };
  }

  if (!type || distanceKm <= 0) {
    return {
      status: "rest",
      type: null,
      label: "Descanso",
      dateLabel,
      distanceKm: 0,
      source: plannedWorkout ? "sisrun-workout" : "sisrun-row",
      evidence,
      plannedWorkout,
      sisrunRow,
    };
  }

  return {
    status: "planned",
    type,
    label: getWorkoutLabel(type),
    dateLabel,
    distanceKm,
    source: plannedWorkout ? "sisrun-workout" : "sisrun-row",
    evidence,
    plannedWorkout,
    sisrunRow,
  };
}

function getWorkoutScoreReason(type: EquipmentWorkoutType) {
  const reasons: Record<EquipmentWorkoutType, string> = {
    regenerativo: "prioriza conforto e menor agressividade",
    rodagem: "prioriza durabilidade e estabilidade para treino diário",
    intervalado: "prioriza leveza, resposta e transição rápida",
    fartlek: "prioriza versatilidade para alternância de ritmos",
    ritmo: "prioriza resposta sem gastar tênis exclusivamente de prova",
    longao: "prioriza proteção, economia e conforto acumulado",
    trail: "prioriza solado e segurança em terreno irregular",
    prova_curta: "prioriza performance para prova curta",
    prova_longa: "prioriza performance e economia para prova longa",
  };

  return reasons[type];
}

export function scoreShoeForWorkout(
  gear: GearForRecommendation,
  workoutType: EquipmentWorkoutType,
) {
  const profile = inferShoeProfile(gear.name);
  const reasons: string[] = [];
  let score = 0;

  if (profile.raceOnly && !workoutType.startsWith("prova_")) {
    score -= 220;
    reasons.push("preservado para provas/simulados");
  }

  if (profile.strengths.includes(workoutType)) {
    score += 100;
    reasons.push(`perfil forte para ${getWorkoutLabel(workoutType).toLowerCase()}`);
  }

  if (profile.secondary?.includes(workoutType)) {
    score += 55;
    reasons.push(`também funciona bem para ${getWorkoutLabel(workoutType).toLowerCase()}`);
  }

  if (!profile.strengths.includes(workoutType) && !profile.secondary?.includes(workoutType)) {
    score += 10;
  }

  const wearRatio = gear.totalKm / Math.max(gear.maxKm, 1);
  if (wearRatio >= 1) {
    score -= 100;
    reasons.push("desgaste acima da vida útil estimada");
  } else if (wearRatio >= 0.75) {
    score -= 45;
    reasons.push("já está bem rodado");
  } else if (wearRatio >= 0.4) {
    score -= 15;
    reasons.push("desgaste moderado");
  } else {
    score += 12;
    reasons.push("desgaste ainda baixo");
  }

  if (workoutType === "longao" && gear.maxKm >= 750) score += 10;
  if (workoutType === "trail" && profile.key !== "fila-skytrail") score -= 60;
  if (workoutType.startsWith("prova_") && profile.raceOnly) score += 40;

  return {
    score,
    profile,
    reasons: [getWorkoutScoreReason(workoutType), ...reasons],
  };
}

export function pickRecommendedShoeForWorkout(
  gears: GearForRecommendation[],
  workout: EquipmentWorkout,
): ShoeRecommendation | null {
  if (workout.status !== "planned" || !workout.type) return null;

  const ranked = gears
    .map((gear) => {
      const scored = scoreShoeForWorkout(gear, workout.type as EquipmentWorkoutType);
      return {
        ...gear,
        recommendationScore: scored.score,
        profile: scored.profile,
        reasons: scored.reasons,
      };
    })
    .filter((gear) => gear.recommendationScore > -200)
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

  return ranked[0] ?? null;
}

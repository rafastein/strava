import type { SisrunParsedData, SisrunRow, SisrunWorkout } from "./sisrun-utils";
import {
  formatPlannedWorkoutDateLabel,
  getStructuredWorkoutSourceLabel,
  type StructuredPlannedWorkout,
} from "./planned-workout";

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
  source: "structured-workout" | "race-calendar" | "sisrun-workout" | "sisrun-row" | "none";
  evidence: string[];
  plannedWorkout?: SisrunWorkout | null;
  sisrunRow?: SisrunRow | null;
  structuredWorkout?: StructuredPlannedWorkout | null;
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
    key: "asics-magic-speed-5",
    label: "ASICS Magic Speed 5",
    match: ["magic speed"],
    brand: "asics",
    maxKm: 600,
    strengths: ["intervalado", "ritmo", "prova_curta"],
    secondary: ["fartlek", "prova_longa"],
    notes: "Tênis com placa para velocidade, ritmo e provas, com durabilidade de treinador rápido.",
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
    key: "saucony-endorphin-pro-4",
    label: "Saucony Endorphin Pro 4",
    match: ["endorphin pro"],
    brand: "saucony",
    maxKm: 500,
    strengths: ["prova_curta", "prova_longa"],
    secondary: ["ritmo"],
    raceOnly: true,
    notes: "Supershoe com placa reservado para provas e treinos específicos de ritmo.",
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
  if (lower.includes("saucony")) return "saucony";
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
): number | null {
  const workoutDistance = plannedWorkout?.plannedDistanceKm;
  if (typeof workoutDistance === "number" && workoutDistance > 0) return workoutDistance;

  const rowDistance = sisrunRow?.plannedDistanceKm;
  if (typeof rowDistance === "number" && rowDistance > 0) return rowDistance;

  return null;
}

function parseTimeToSeconds(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return 0;

  const [, h, m, s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function getMaxPlannedSeconds(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
) {
  return Math.max(
    parseTimeToSeconds(plannedWorkout?.minTime),
    parseTimeToSeconds(plannedWorkout?.maxTime),
    parseTimeToSeconds(sisrunRow?.minPlannedTime),
    parseTimeToSeconds(sisrunRow?.maxPlannedTime),
  );
}

function hasPlannedTimeWindow(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
) {
  return getMaxPlannedSeconds(plannedWorkout, sisrunRow) > 0;
}

function hasPlannedWorkoutSignal(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
) {
  const distanceKm = getDistanceFromWorkout(plannedWorkout, sisrunRow);
  const workoutType = normalizeText(plannedWorkout?.workoutType);

  return Boolean(
    (typeof distanceKm === "number" && distanceKm > 0) ||
      (sisrunRow?.plannedWorkouts ?? 0) > 0 ||
      hasPlannedTimeWindow(plannedWorkout, sisrunRow) ||
      (workoutType && !hasAny(workoutType, ["descanso", "off"]))
  );
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
    plannedWorkout?.minTime ? `mín. ${plannedWorkout.minTime}` : null,
    plannedWorkout?.maxTime ? `máx. ${plannedWorkout.maxTime}` : null,
    sisrunRow?.minPlannedTime ? `mín. ${sisrunRow.minPlannedTime}` : null,
    sisrunRow?.maxPlannedTime ? `máx. ${sisrunRow.maxPlannedTime}` : null,
  ].filter((item): item is string => {
    if (!item) return false;
    const normalized = normalizeText(item);
    return !normalized.includes("sem treino realizado registrado");
  });

  return Array.from(new Set(evidence));
}

export function classifyEquipmentWorkout(
  plannedWorkout?: SisrunWorkout | null,
  sisrunRow?: SisrunRow | null,
): EquipmentWorkoutType | null {
  const distanceKm = getDistanceFromWorkout(plannedWorkout, sisrunRow);
  const hasDistance = typeof distanceKm === "number" && distanceKm > 0;
  const hasPlan = hasPlannedWorkoutSignal(plannedWorkout, sisrunRow);
  const maxPlannedSeconds = getMaxPlannedSeconds(plannedWorkout, sisrunRow);
  const workoutTypeText = normalizeText(plannedWorkout?.workoutType);
  const text = normalizeText(
    [
      plannedWorkout?.workoutType,
      plannedWorkout?.intensity,
      plannedWorkout?.routeType,
      plannedWorkout?.description,
    ].join(" ")
  );

  if (!hasPlan) return null;

  const explicitRest = hasAny(workoutTypeText, ["descanso", "off"]);
  if (explicitRest && !hasDistance && !hasPlannedTimeWindow(plannedWorkout, sisrunRow) && (sisrunRow?.plannedWorkouts ?? 0) <= 0) {
    return null;
  }

  if (plannedWorkout?.isRace) {
    return (distanceKm ?? 0) <= 10 ? "prova_curta" : "prova_longa";
  }

  if (hasAny(text, ["trilha", "trail", "montanha", "terra"])) return "trail";
  if (hasAny(text, ["prova", "race", "competicao", "competição"])) {
    return (distanceKm ?? 0) <= 10 ? "prova_curta" : "prova_longa";
  }
  if (hasAny(text, ["longao", "longão", "longo"]) || (hasDistance && distanceKm >= 16)) return "longao";
  if (hasAny(text, ["fartlek", "variacao", "variação"])) return "fartlek";
  if (hasAny(text, ["interval", "tiro", "repet", "pista", "400", "500", "600", "800", "1000", "z5"])) {
    return "intervalado";
  }
  if (hasAny(text, ["ritmo", "tempo", "limiar", "progressivo", "maratona", "pace", "z3", "z4"])) {
    return "ritmo";
  }
  if (hasAny(text, ["regenerativo", "recuper", "leve", "z1"]) || (hasDistance && distanceKm <= 6.5)) {
    return "regenerativo";
  }

  // Fallback para planilhas agregadas do SisRUN: alguns uploads informam apenas
  // "Treino" + janela de tempo, sem distância ou descrição dos blocos.
  // Sem intensidade/descrição explícita, tratamos como rodagem, não como pista.

  if (!hasDistance && maxPlannedSeconds >= 75 * 60) return "longao";
  if (!hasDistance && maxPlannedSeconds > 0 && maxPlannedSeconds <= 35 * 60) return "regenerativo";

  return "rodagem";
}


export type RaceEquipmentInput = {
  dateKey: string;
  name: string;
  distanceKm: number;
  location?: string | null;
  objective?: string | null;
};

export function getEquipmentWorkoutFromRace(
  race: RaceEquipmentInput,
): EquipmentWorkout {
  const distanceKm = Number.isFinite(race.distanceKm) && race.distanceKm > 0
    ? race.distanceKm
    : null;
  const type: EquipmentWorkoutType = (distanceKm ?? 0) <= 10
    ? "prova_curta"
    : "prova_longa";

  return {
    status: "planned",
    type,
    label: getWorkoutLabel(type),
    dateLabel: formatPlannedWorkoutDateLabel(race.dateKey),
    distanceKm,
    source: "race-calendar",
    evidence: [
      `Prova: ${race.name}`,
      race.location ? `Local: ${race.location}` : null,
      race.objective ? `Objetivo: ${race.objective}` : null,
    ].filter((item): item is string => Boolean(item)),
  };
}

export function getEquipmentWorkoutFromStructuredWorkout(
  structuredWorkout: StructuredPlannedWorkout,
): EquipmentWorkout {
  const type = structuredWorkout.type === "descanso" || structuredWorkout.type === "forca" || structuredWorkout.type === "indefinido"
    ? null
    : structuredWorkout.type;

  const evidence = [
    getStructuredWorkoutSourceLabel(structuredWorkout.source),
    structuredWorkout.title,
    structuredWorkout.description,
    structuredWorkout.durationMin ? `${structuredWorkout.durationMin} min` : null,
    ...structuredWorkout.steps.slice(0, 4).map((step) => {
      const repeat = step.repeat ? `${step.repeat}x ` : "";
      const distance = step.distanceKm ? ` ${step.distanceKm.toFixed(2)} km` : "";
      const intensity = step.intensity ? ` ${step.intensity}` : "";
      return `${repeat}${step.label}${distance}${intensity}`.trim();
    }),
  ].filter((item): item is string => Boolean(item));

  if (!type) {
    return {
      status: structuredWorkout.type === "descanso" ? "rest" : "unknown",
      type: null,
      label: structuredWorkout.type === "descanso" ? "Descanso" : "Treino estruturado sem corrida",
      dateLabel: formatPlannedWorkoutDateLabel(structuredWorkout.date),
      distanceKm: structuredWorkout.distanceKm,
      source: "structured-workout",
      evidence,
      structuredWorkout,
    };
  }

  return {
    status: "planned",
    type,
    label: getWorkoutLabel(type),
    dateLabel: formatPlannedWorkoutDateLabel(structuredWorkout.date),
    distanceKm: structuredWorkout.distanceKm,
    source: "structured-workout",
    evidence,
    structuredWorkout,
  };
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

  if (!type) {
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

export function getDaysSinceLastUse(
  lastUse: string | null | undefined,
  referenceDate = new Date(),
): number | null {
  if (!lastUse) return null;

  const parsedLastUse = new Date(lastUse);
  if (Number.isNaN(parsedLastUse.getTime()) || Number.isNaN(referenceDate.getTime())) {
    return null;
  }

  const toBrazilDayOrdinal = (date: Date) => {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const [year, month, day] = parts.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };

  return Math.max(0, Math.floor(toBrazilDayOrdinal(referenceDate) - toBrazilDayOrdinal(parsedLastUse)));
}

export function getShoeRotationScore(
  lastUse: string | null | undefined,
  referenceDate = new Date(),
) {
  const daysSinceLastUse = getDaysSinceLastUse(lastUse, referenceDate);

  if (daysSinceLastUse === null) {
    return { score: 0, daysSinceLastUse, reason: null as string | null };
  }

  if (daysSinceLastUse === 0) {
    return { score: -8, daysSinceLastUse, reason: "usado hoje; o rodízio reduz a prioridade" };
  }

  if (daysSinceLastUse <= 2) {
    return {
      score: -4,
      daysSinceLastUse,
      reason: `usado há ${daysSinceLastUse} ${daysSinceLastUse === 1 ? "dia" : "dias"}; o rodízio reduz a prioridade`,
    };
  }

  let score = 2;
  if (daysSinceLastUse >= 45) score = 24;
  else if (daysSinceLastUse >= 30) score = 18;
  else if (daysSinceLastUse >= 21) score = 14;
  else if (daysSinceLastUse >= 14) score = 10;
  else if (daysSinceLastUse >= 7) score = 6;

  return {
    score,
    daysSinceLastUse,
    reason: `há ${daysSinceLastUse} dias sem uso; ganha prioridade no rodízio`,
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
  referenceDate = new Date(),
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

  const isPrimaryFit = profile.strengths.includes(workoutType);
  const isSecondaryFit = profile.secondary?.includes(workoutType) ?? false;

  if (!isPrimaryFit && !isSecondaryFit) {
    score += 10;
  }

  const canUseRotationScore =
    (isPrimaryFit || isSecondaryFit) &&
    !(profile.raceOnly && !workoutType.startsWith("prova_"));

  if (canUseRotationScore) {
    const rotation = getShoeRotationScore(gear.lastUse, referenceDate);
    score += rotation.score;
    if (rotation.reason) reasons.push(rotation.reason);
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
  referenceDate = new Date(),
): ShoeRecommendation | null {
  if (workout.status !== "planned" || !workout.type) return null;

  const ranked = gears
    .map((gear) => {
      const scored = scoreShoeForWorkout(
        gear,
        workout.type as EquipmentWorkoutType,
        referenceDate,
      );
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

export type DatedEquipmentWorkout = {
  date: string;
  workout: EquipmentWorkout;
};

function getReferenceDateForIsoDate(dateIso: string) {
  const parsed = new Date(`${dateIso}T12:00:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Monta recomendações em ordem cronológica e trata cada recomendação futura
 * como um uso virtual do tênis escolhido. Assim, treinos seguintes passam a
 * enxergar aquele modelo como recém-usado e o rodízio avança para outro tênis
 * adequado que esteja há mais tempo parado.
 *
 * Datas anteriores a startDateIso não alteram o estado virtual: o histórico
 * real do Strava continua sendo a fonte de verdade para o passado.
 */
export function buildSequentialShoeRecommendations(
  gears: GearForRecommendation[],
  datedWorkouts: DatedEquipmentWorkout[],
  options?: {
    startDateIso?: string;
    pastReferenceDate?: Date;
  },
) {
  const startDateIso = options?.startDateIso;
  const pastReferenceDate = options?.pastReferenceDate ?? new Date();
  const virtualGears = gears.map((gear) => ({ ...gear }));
  const recommendations = new Map<string, ShoeRecommendation | null>();

  const orderedWorkouts = [...datedWorkouts].sort((a, b) => a.date.localeCompare(b.date));

  orderedWorkouts.forEach(({ date, workout }) => {
    const isSequentialDate = !startDateIso || date >= startDateIso;
    const recommendation = pickRecommendedShoeForWorkout(
      isSequentialDate ? virtualGears : gears,
      workout,
      isSequentialDate ? getReferenceDateForIsoDate(date) : pastReferenceDate,
    );

    recommendations.set(date, recommendation);

    if (!isSequentialDate || !recommendation) return;

    const selectedGear = virtualGears.find((gear) =>
      recommendation.gearId
        ? gear.gearId === recommendation.gearId
        : gear.name === recommendation.name,
    );

    if (selectedGear) {
      selectedGear.lastUse = `${date}T12:00:00-03:00`;
    }
  });

  return recommendations;
}

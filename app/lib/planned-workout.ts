import { getRedisClient } from "./redis-client";
import type { SisrunParsedData } from "./sisrun-utils";

export const PLANNED_WORKOUT_KEY_PREFIX = "planned-workout:";

export type PlannedWorkoutSource = "coros" | "manual" | "import";

export type PlannedWorkoutType =
  | "regenerativo"
  | "rodagem"
  | "intervalado"
  | "fartlek"
  | "ritmo"
  | "longao"
  | "trail"
  | "prova_curta"
  | "prova_longa"
  | "forca"
  | "descanso"
  | "indefinido";

export type PlannedWorkoutStep = {
  label: string;
  repeat?: number | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  intensity?: string | null;
  target?: string | null;
  kind?: "aquecimento" | "bloco" | "recuperacao" | "desaquecimento" | "outro";
};

export type StructuredPlannedWorkout = {
  date: string;
  source: PlannedWorkoutSource;
  title: string;
  type: PlannedWorkoutType;
  distanceKm: number | null;
  durationMin: number | null;
  description?: string | null;
  steps: PlannedWorkoutStep[];
  externalId?: string | null;
  importedAt: string;
  raw?: unknown;
};

export type PlannedWorkoutDataResult = {
  data: StructuredPlannedWorkout | null;
  source: "redis" | "none";
  sourceLabel: string;
  key: string;
  redisConfigured: boolean;
};

export type StructuredPlannedWorkoutRangeResult = PlannedWorkoutDataResult & {
  date: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveNumberOrNull(value: unknown) {
  const parsed = toNumberOrNull(value);
  return parsed && parsed > 0 ? parsed : null;
}

export function getTodayIsoDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getPlannedWorkoutKey(dateIso: string) {
  return `${PLANNED_WORKOUT_KEY_PREFIX}${dateIso}`;
}

export function formatPlannedWorkoutDateLabel(dateIso: string) {
  const match = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateIso;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

function getTextForClassification(input: {
  title?: string | null;
  description?: string | null;
  steps?: PlannedWorkoutStep[] | null;
}) {
  return normalizeText(
    [
      input.title,
      input.description,
      ...(input.steps ?? []).flatMap((step) => [
        step.label,
        step.intensity,
        step.target,
        step.kind,
        step.repeat ? `${step.repeat}x` : null,
        step.distanceKm ? `${step.distanceKm * 1000}m` : null,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function classifyStructuredWorkout(input: {
  title?: string | null;
  description?: string | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  steps?: PlannedWorkoutStep[] | null;
  isRace?: boolean | null;
}): PlannedWorkoutType {
  const distanceKm = input.distanceKm ?? null;
  const text = getTextForClassification(input);
  const steps = input.steps ?? [];
  const hasRepeatedSteps = steps.some((step) => (step.repeat ?? 0) >= 2);
  const hasShortDistanceBlocks = steps.some((step) => {
    const meters = (step.distanceKm ?? 0) * 1000;
    return meters >= 100 && meters <= 1600;
  });

  if (input.isRace || hasAny(text, ["prova", "race", "competicao", "competição"])) {
    return (distanceKm ?? 0) <= 10 ? "prova_curta" : "prova_longa";
  }

  if (hasAny(text, ["descanso", "off", "rest day"])) return "descanso";
  if (hasAny(text, ["forca", "força", "musculacao", "musculação", "strength"])) return "forca";
  if (hasAny(text, ["trilha", "trail", "montanha", "terra"])) return "trail";
  if (hasAny(text, ["longao", "longão", "longo"]) || (distanceKm !== null && distanceKm >= 16)) return "longao";
  if (hasAny(text, ["fartlek", "variacao", "variação"])) return "fartlek";
  if (
    hasRepeatedSteps ||
    hasShortDistanceBlocks ||
    hasAny(text, ["interval", "tiro", "repet", "pista", "400", "500", "600", "800", "1000", "z5"])
  ) {
    return "intervalado";
  }
  if (hasAny(text, ["ritmo", "tempo", "limiar", "progressivo", "maratona", "pace", "z3", "z4"])) return "ritmo";
  if (hasAny(text, ["regenerativo", "recuper", "leve", "z1"]) || (distanceKm !== null && distanceKm <= 6.5)) return "regenerativo";

  if (input.durationMin && input.durationMin >= 75) return "longao";
  if (input.durationMin && input.durationMin <= 35) return "regenerativo";

  return "rodagem";
}

function normalizeStep(rawStep: unknown): PlannedWorkoutStep | null {
  if (!rawStep || typeof rawStep !== "object") return null;
  const step = rawStep as Record<string, unknown>;
  const label = String(step.label ?? step.name ?? step.title ?? "").trim();
  if (!label) return null;

  const kind = String(step.kind ?? "outro").trim() as PlannedWorkoutStep["kind"];
  const allowedKinds = new Set(["aquecimento", "bloco", "recuperacao", "desaquecimento", "outro"]);

  return {
    label,
    repeat: toPositiveNumberOrNull(step.repeat),
    distanceKm: toPositiveNumberOrNull(step.distanceKm ?? step.distance),
    durationMin: toPositiveNumberOrNull(step.durationMin ?? step.duration),
    intensity: typeof step.intensity === "string" ? step.intensity : null,
    target: typeof step.target === "string" ? step.target : null,
    kind: allowedKinds.has(kind ?? "") ? kind : "outro",
  };
}

export function normalizeStructuredWorkout(
  raw: unknown,
  fallbackDate = getTodayIsoDate(),
): StructuredPlannedWorkout {
  if (!raw || typeof raw !== "object") {
    throw new Error("Treino estruturado inválido.");
  }

  const input = raw as Record<string, unknown>;
  const date = String(input.date ?? fallbackDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Use a data no formato YYYY-MM-DD.");
  }

  const title = String(input.title ?? input.name ?? "Treino estruturado").trim();
  if (!title) throw new Error("Informe um título para o treino.");

  const sourceCandidate = String(input.source ?? "manual").trim().toLowerCase();
  const source: PlannedWorkoutSource =
    sourceCandidate === "coros" || sourceCandidate === "import" ? sourceCandidate : "manual";

  const steps = Array.isArray(input.steps)
    ? input.steps.map(normalizeStep).filter((step): step is PlannedWorkoutStep => Boolean(step))
    : [];

  const explicitType = typeof input.type === "string" ? normalizeText(input.type) : "";
  const allowedTypes: PlannedWorkoutType[] = [
    "regenerativo",
    "rodagem",
    "intervalado",
    "fartlek",
    "ritmo",
    "longao",
    "trail",
    "prova_curta",
    "prova_longa",
    "forca",
    "descanso",
    "indefinido",
  ];

  const distanceKm = toPositiveNumberOrNull(input.distanceKm ?? input.distance);
  const durationMin = toPositiveNumberOrNull(input.durationMin ?? input.duration);
  const description = typeof input.description === "string" ? input.description : null;
  const inferredType = classifyStructuredWorkout({ title, description, distanceKm, durationMin, steps });
  const type = allowedTypes.includes(explicitType as PlannedWorkoutType)
    ? (explicitType as PlannedWorkoutType)
    : inferredType;

  return {
    date,
    source,
    title,
    type,
    distanceKm,
    durationMin,
    description,
    steps,
    externalId: typeof input.externalId === "string" ? input.externalId : null,
    importedAt: typeof input.importedAt === "string" ? input.importedAt : new Date().toISOString(),
    raw: input.raw,
  };
}

async function readStructuredPlannedWorkoutFromRedis(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  dateIso: string,
): Promise<PlannedWorkoutDataResult> {
  const key = getPlannedWorkoutKey(dateIso);

  if (!redis) {
    return {
      data: null,
      source: "none",
      sourceLabel: "Upstash não configurado",
      key,
      redisConfigured: false,
    };
  }

  const raw = await redis.get<StructuredPlannedWorkout | string>(key);
  if (!raw) {
    return {
      data: null,
      source: "none",
      sourceLabel: "Nenhum treino estruturado no Upstash",
      key,
      redisConfigured: true,
    };
  }

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const workout = normalizeStructuredWorkout(parsed, dateIso);

  return {
    data: workout,
    source: "redis",
    sourceLabel: workout.source === "coros" ? "Upstash/COROS" : "Upstash",
    key,
    redisConfigured: true,
  };
}

export async function getStructuredPlannedWorkout(
  dateIso = getTodayIsoDate(),
): Promise<PlannedWorkoutDataResult> {
  const redis = await getRedisClient();
  return readStructuredPlannedWorkoutFromRedis(redis, dateIso);
}

export async function saveStructuredPlannedWorkout(raw: unknown) {
  const workout = normalizeStructuredWorkout(raw);
  const redis = await getRedisClient();

  if (!redis) {
    throw new Error("Upstash não configurado. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.");
  }

  const key = getPlannedWorkoutKey(workout.date);
  await redis.set(key, workout);

  return { key, workout };
}

export async function deleteStructuredPlannedWorkout(dateIso = getTodayIsoDate()) {
  const redis = await getRedisClient();
  const key = getPlannedWorkoutKey(dateIso);

  if (!redis) {
    throw new Error("Upstash não configurado. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.");
  }

  await redis.del(key);
  return { key };
}

export function getIsoDatesForRange(days = 7, startDate = new Date()) {
  return Array.from({ length: Math.max(0, days) }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return getTodayIsoDate(date);
  });
}

export async function getStructuredPlannedWorkoutsForRange(
  days = 7,
  startDate = new Date(),
): Promise<StructuredPlannedWorkoutRangeResult[]> {
  const dates = getIsoDatesForRange(days, startDate);
  const redis = await getRedisClient();
  const results = await Promise.all(dates.map((date) => readStructuredPlannedWorkoutFromRedis(redis, date)));

  return results.map((result, index) => ({
    ...result,
    date: dates[index],
  }));
}

export function getStructuredWorkoutPlannedDistanceKm(workout: StructuredPlannedWorkout | null | undefined) {
  if (!workout || workout.type === "descanso" || workout.type === "forca" || workout.type === "indefinido") return 0;
  return typeof workout.distanceKm === "number" && Number.isFinite(workout.distanceKm) ? workout.distanceKm : null;
}

export function isStructuredRunningWorkout(workout: StructuredPlannedWorkout | null | undefined) {
  if (!workout) return false;
  return workout.type !== "descanso" && workout.type !== "forca" && workout.type !== "indefinido";
}

export function buildSisrunFallbackWorkoutSummary(data: SisrunParsedData | null) {
  const weeks = data?.weeks ?? [];
  const rows = data?.rows ?? [];
  return {
    weeks: weeks.length,
    rows: rows.length,
    workouts: weeks.reduce((sum, week) => sum + (week.workoutCount ?? 0), 0),
  };
}

export function getStructuredWorkoutSourceLabel(source: PlannedWorkoutSource) {
  const labels: Record<PlannedWorkoutSource, string> = {
    coros: "COROS",
    manual: "Manual / Upstash",
    import: "Importação estruturada",
  };

  return labels[source];
}

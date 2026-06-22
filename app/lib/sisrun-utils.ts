import fs from "fs/promises";
import path from "path";
import { getRedisClient } from "./redis-client";
import { isRunActivity } from "./strava-activity";

export type SisrunRow = {
  date: string;
  plannedWorkouts?: number;
  completedWorkouts?: number;
  completionPct?: number;
  plannedDistanceKm: number;
  completedDistanceKm: number;
  minPlannedTime: string | null;
  maxPlannedTime: string | null;
  completedTime?: string | null;
  avgPace?: string | null;
  avgHeartRate?: number | null;
  elevationGain?: number;
  calories?: number;
};

export type SisrunWorkout = {
  weekday?: string;
  dateLabel: string;
  modality?: string;
  workoutType?: string;
  intensity?: string;
  plannedDistanceKm?: number | null;
  routeType?: string;
  description?: string;
  minTime?: string | null;
  maxTime?: string | null;
  isRace?: boolean;
};

export type SisrunWeek = {
  weekStart: string;
  weekEnd: string;
  weekLabel?: string;
  totalPlannedKm: number;
  longRunPlannedKm: number;
  workoutCount?: number;
  raceCount?: number;
  completedKm?: number;
  completedWorkouts?: number;
  adherencePct?: number;
  workouts?: SisrunWorkout[];
};

export type SisrunParsedData = {
  athleteName?: string;
  uploadedAt?: string;
  fileName?: string;
  rows: SisrunRow[];
  weeks: SisrunWeek[];
};

export type SisrunDataSource = "redis" | "file" | "none";

export type SisrunDataResult = {
  data: SisrunParsedData | null;
  source: SisrunDataSource;
  sourceLabel: string;
  redisConfigured: boolean;
  key: typeof SISRUN_KEY;
  filePath: string;
  error?: string;
};

export type SisrunStatusSummary = {
  source: SisrunDataSource;
  sourceLabel: string;
  redisConfigured: boolean;
  key: typeof SISRUN_KEY;
  filePath: string;
  loaded: boolean;
  athleteName: string;
  fileName: string;
  uploadedAt: string | null;
  uploadedAtLabel: string;
  ageDays: number | null;
  weeksCount: number;
  rowsCount: number;
  workoutCount: number;
  totalPlannedKm: number;
  firstWeekLabel: string | null;
  lastWeekLabel: string | null;
  currentWeekLabel: string | null;
  warningsCount: number;
  error?: string;
};

export type SisrunDataQualityWarning = {
  level: "warning" | "error";
  title: string;
  description: string;
};

export type WeeklyPlannedSegment = {
  date: string;
  dayLabel: string;
  distanceKm: number;
};

export type WeeklyComparisonItem = {
  key: string;
  label: string;
  plannedKm: number;
  executedKm: number;
  adherencePct: number | null;
  plannedSegments?: WeeklyPlannedSegment[];
};

export type StravaActivitySummary = {
  type?: string;
  sport_type?: string;
  distance: number;
  start_date?: string;
  start_date_local?: string;
};

export const SISRUN_KEY = "sisrun:latest";

const SISRUN_FILE_PATH = path.join(process.cwd(), "data", "sisrun-latest.json");

function getActivityDate(activity: StravaActivitySummary): Date | null {
  const raw = activity.start_date_local ?? activity.start_date;
  if (!raw) return null;

  // Strava start_date_local vem como horário local, mas às vezes com "Z".
  // Aqui a gente interpreta como data local, sem deixar o JS deslocar o dia.
  if (activity.start_date_local) {
    const match = String(raw).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
    );

    if (match) {
      const [, y, m, d, h, min, s] = match;
      return new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(h),
        Number(min),
        Number(s)
      );
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getTodayBrazilDate() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [y, m, d] = parts.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDateKey(date: Date) {
  return date.toLocaleDateString("sv-SE");
}

function parseSisrunPayload(raw: unknown): SisrunParsedData | null {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as Partial<SisrunParsedData>).rows) &&
      Array.isArray((parsed as Partial<SisrunParsedData>).weeks)
    ) {
      return parsed as SisrunParsedData;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getSisrunDataWithSource(): Promise<SisrunDataResult> {
  const redisConfigured = Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)
  );

  try {
    const redis = await getRedisClient();
    if (redis) {
      const raw = await redis.get<SisrunParsedData | string>(SISRUN_KEY);
      const data = parseSisrunPayload(raw);
      if (data) {
        return {
          data,
          source: "redis",
          sourceLabel: "Redis / Upstash",
          redisConfigured,
          key: SISRUN_KEY,
          filePath: SISRUN_FILE_PATH,
        };
      }

      return {
        data: null,
        source: "none",
        sourceLabel: "Redis configurado, sem SisRUN salvo",
        redisConfigured,
        key: SISRUN_KEY,
        filePath: SISRUN_FILE_PATH,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao ler Redis.";
    return {
      data: null,
      source: "none",
      sourceLabel: "Redis configurado, mas indisponível",
      redisConfigured,
      key: SISRUN_KEY,
      filePath: SISRUN_FILE_PATH,
      error: message,
    };
  }

  try {
    const content = await fs.readFile(SISRUN_FILE_PATH, "utf-8");
    const data = parseSisrunPayload(content);
    if (data) {
      return {
        data,
        source: "file",
        sourceLabel: "Arquivo local",
        redisConfigured,
        key: SISRUN_KEY,
        filePath: SISRUN_FILE_PATH,
      };
    }

    return {
      data: null,
      source: "none",
      sourceLabel: "Arquivo local inválido",
      redisConfigured,
      key: SISRUN_KEY,
      filePath: SISRUN_FILE_PATH,
      error: "O arquivo data/sisrun-latest.json existe, mas não parece ter o formato esperado.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SisRUN não encontrado.";
    return {
      data: null,
      source: "none",
      sourceLabel: redisConfigured ? "Sem dados carregados" : "Sem Redis e sem arquivo local",
      redisConfigured,
      key: SISRUN_KEY,
      filePath: SISRUN_FILE_PATH,
      error: message,
    };
  }
}

export async function getSisrunData(): Promise<SisrunParsedData | null> {
  const result = await getSisrunDataWithSource();
  return result.data;
}

export function parseBrDate(dateStr: string) {
  if (!dateStr || typeof dateStr !== "string") return null;

  const clean = dateStr.trim();
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
}

export function getWeekEnd(date: Date) {
  const d = new Date(getWeekStart(date));
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);

  return d;
}

export function formatWeekLabel(date: Date) {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);

  const startLabel = start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  const endLabel = end.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return `${startLabel}–${endLabel}`;
}

export function getCurrentWeek(data: SisrunParsedData | null) {
  if (!data?.weeks?.length) return null;

  const today = getTodayBrazilDate();

  return (
    data.weeks.find((w) => {
      const start = parseBrDate(w.weekStart);
      const end = parseBrDate(w.weekEnd);

      if (!start || !end) return false;

      const endWithTime = new Date(end);
      endWithTime.setHours(23, 59, 59, 999);

      return today >= start && today <= endWithTime;
    }) ?? data.weeks[data.weeks.length - 1]
  );
}

export function getTodaySisrunRow(data: SisrunParsedData | null) {
  if (!data?.rows?.length) return null;

  const today = getTodayBrazilDate().toLocaleDateString("pt-BR");
  return data.rows.find((r) => r.date === today) ?? null;
}

export function getSisrunDataQualityWarnings(
  data: SisrunParsedData | null
): SisrunDataQualityWarning[] {
  if (!data) return [];

  const warnings: SisrunDataQualityWarning[] = [];
  const currentWeek = getCurrentWeek(data);

  if (data.uploadedAt) {
    const uploadedDate = new Date(data.uploadedAt);
    if (!Number.isNaN(uploadedDate.getTime())) {
      const ageDays = Math.floor(
        (getTodayBrazilDate().getTime() - uploadedDate.getTime()) / 86_400_000
      );

      if (ageDays > 14) {
        warnings.push({
          level: "warning",
          title: "Planilha possivelmente desatualizada",
          description: `Último upload registrado há ${ageDays} dias${data.fileName ? ` (${data.fileName})` : ""}.`,
        });
      }
    }
  }

  if (currentWeek && currentWeek.totalPlannedKm === 0 && (currentWeek.workoutCount ?? 0) === 0) {
    warnings.push({
      level: "warning",
      title: "Semana atual sem treino planejado",
      description: `${currentWeek.weekStart} até ${currentWeek.weekEnd} aparece com 0 km e 0 treinos. Confirme se é descanso planejado ou ausência de atualização.`,
    });
  }

  data.weeks?.forEach((week) => {
    if (week.totalPlannedKm > 70 || week.longRunPlannedKm > 50) {
      warnings.push({
        level: "error",
        title: "Volume planejado suspeito",
        description: `${week.weekStart} até ${week.weekEnd} aparece com ${week.totalPlannedKm.toFixed(1)} km planejados e longão de ${week.longRunPlannedKm.toFixed(1)} km.`,
      });
    }

    if ((week.workoutCount ?? 0) > 0 && week.totalPlannedKm === 0) {
      warnings.push({
        level: "warning",
        title: "Treino sem distância planejada",
        description: `${week.weekStart} até ${week.weekEnd} tem ${week.workoutCount} treino(s), mas 0 km planejados.`,
      });
    }
  });

  return warnings;
}

function formatUploadedAtLabel(uploadedAt?: string) {
  if (!uploadedAt) return "Não informado";

  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return uploadedAt;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getUploadAgeDays(uploadedAt?: string) {
  if (!uploadedAt) return null;
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((getTodayBrazilDate().getTime() - date.getTime()) / 86_400_000));
}

function formatWeekRange(week: SisrunWeek | null | undefined) {
  if (!week) return null;
  return `${week.weekStart} até ${week.weekEnd}`;
}

export function buildSisrunStatusSummary(
  result: SisrunDataResult,
  warnings: SisrunDataQualityWarning[] = getSisrunDataQualityWarnings(result.data)
): SisrunStatusSummary {
  const data = result.data;
  const weeks = data?.weeks ?? [];
  const rows = data?.rows ?? [];
  const firstWeek = weeks[0] ?? null;
  const lastWeek = weeks[weeks.length - 1] ?? null;
  const currentWeek = getCurrentWeek(data);

  return {
    source: result.source,
    sourceLabel: result.sourceLabel,
    redisConfigured: result.redisConfigured,
    key: result.key,
    filePath: result.filePath,
    loaded: Boolean(data),
    athleteName: data?.athleteName || "Não informado",
    fileName: data?.fileName || "Não informado",
    uploadedAt: data?.uploadedAt ?? null,
    uploadedAtLabel: formatUploadedAtLabel(data?.uploadedAt),
    ageDays: getUploadAgeDays(data?.uploadedAt),
    weeksCount: weeks.length,
    rowsCount: rows.length,
    workoutCount: weeks.reduce((sum, week) => sum + (week.workoutCount ?? 0), 0),
    totalPlannedKm: Number(weeks.reduce((sum, week) => sum + week.totalPlannedKm, 0).toFixed(1)),
    firstWeekLabel: formatWeekRange(firstWeek),
    lastWeekLabel: formatWeekRange(lastWeek),
    currentWeekLabel: formatWeekRange(currentWeek),
    warningsCount: warnings.length,
    error: result.error,
  };
}

export function getCurrentWeekStravaKm(activities: StravaActivitySummary[]) {
  const currentWeekKey = getWeekStart(getTodayBrazilDate()).toISOString();

  return Number(
    activities
      .filter(isRunActivity)
      .filter((a) => {
        const date = getActivityDate(a);
        if (!date) return false;

        return getWeekStart(date).toISOString() === currentWeekKey;
      })
      .reduce((sum, a) => sum + a.distance / 1000, 0)
      .toFixed(1)
  );
}

export function getTodayStravaKm(activities: StravaActivitySummary[]) {
  const todayKey = getDateKey(getTodayBrazilDate());

  return Number(
    activities
      .filter(isRunActivity)
      .filter((a) => {
        const date = getActivityDate(a);
        if (!date) return false;

        return getDateKey(date) === todayKey;
      })
      .reduce((sum, a) => sum + a.distance / 1000, 0)
      .toFixed(1)
  );
}

export function getCurrentWeekLongestRunKm(activities: StravaActivitySummary[]) {
  const currentWeekKey = getWeekStart(getTodayBrazilDate()).toISOString();

  const runs = activities
    .filter(isRunActivity)
    .filter((a) => {
      const date = getActivityDate(a);
      if (!date) return false;

      return getWeekStart(date).toISOString() === currentWeekKey;
    });

  if (!runs.length) return 0;

  return Number(Math.max(...runs.map((a) => a.distance / 1000)).toFixed(1));
}

function getLastWeekAllowedInCurrentMonth() {
  const today = getTodayBrazilDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  return getWeekStart(lastDayOfMonth).getTime();
}

export function buildWeeklyComparison(
  sisrunData: SisrunParsedData | null,
  activities: StravaActivitySummary[],
  limit = 6
): WeeklyComparisonItem[] {
  const map = new Map<string, WeeklyComparisonItem>();

  sisrunData?.weeks?.forEach((week) => {
    const start = parseBrDate(week.weekStart);
    if (!start) return;

    const startTime = start.getTime();
    if (startTime > getLastWeekAllowedInCurrentMonth()) return;

    map.set(start.toISOString(), {
      key: start.toISOString(),
      label: formatWeekLabel(start),
      plannedKm: week.totalPlannedKm,
      executedKm: 0,
      adherencePct: null,
    });
  });

  activities.filter(isRunActivity).forEach((activity) => {
    const date = getActivityDate(activity);
    if (!date) return;

    const weekStart = getWeekStart(date);
    const startTime = weekStart.getTime();
    if (startTime > getLastWeekAllowedInCurrentMonth()) return;

    const key = weekStart.toISOString();
    const existing =
      map.get(key) ??
      {
        key,
        label: formatWeekLabel(weekStart),
        plannedKm: 0,
        executedKm: 0,
        adherencePct: null,
      };

    existing.executedKm += activity.distance / 1000;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-limit)
    .map((item) => {
      const plannedKm = Number(item.plannedKm.toFixed(1));
      const executedKm = Number(item.executedKm.toFixed(1));
      return {
        ...item,
        plannedKm,
        executedKm,
        adherencePct:
          plannedKm > 0
            ? Number(((executedKm / plannedKm) * 100).toFixed(1))
            : null,
      };
    });
}

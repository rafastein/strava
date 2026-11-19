import { buildCorosScheduleWorkouts } from "./coros-planned-workouts";
import {
  deleteStructuredPlannedWorkout,
  getAllStructuredPlannedWorkouts,
  saveStructuredPlannedWorkout,
  type StructuredPlannedWorkout,
  type StructuredPlannedWorkoutRangeResult,
} from "./planned-workout";
import { getRedisClient } from "./redis-client";

// Sincroniza a agenda do COROS com as chaves planned-workout:AAAA-MM-DD.
// Janela: duas semanas para trás (o histórico do plano) até cinco semanas à frente.

const STATUS_KEY = "coros:sync:status";
const LOCK_KEY = "coros:sync:lock";
const WEEKS_BACK = 2;
const DAYS_AHEAD = 35;
/** Sincronização "de passagem" (ao abrir o site) só roda se a última tiver mais que isso. */
export const COROS_SYNC_STALE_MS = 3 * 3600 * 1000;

export type CorosSyncStatus = {
  at: string;
  ok: boolean;
  trigger: string;
  range?: { start: string; end: string };
  saved?: number;
  removed?: number;
  error?: string;
};

export type CorosSyncDeps = {
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  listSaved: () => Promise<StructuredPlannedWorkoutRangeResult[]>;
  save: (workout: StructuredPlannedWorkout) => Promise<unknown>;
  remove: (dateKey: string) => Promise<unknown>;
};

const DAY_MS = 86_400_000;

function keyToUtc(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/** Janela da sincronização a partir de hoje (AAAA-MM-DD, horário de Brasília). */
export function getCorosSyncRange(todayKey: string) {
  const today = keyToUtc(todayKey);
  const mondayOffset = (new Date(today).getUTCDay() + 6) % 7;
  const start = today - (mondayOffset + WEEKS_BACK * 7) * DAY_MS;
  return { start: utcToKey(start), end: utcToKey(today + DAYS_AHEAD * DAY_MS) };
}

function toCorosDate(dateKey: string) {
  return dateKey.replaceAll("-", "");
}

/** A resposta tem cara de agenda do COROS? Sem isso, nada é apagado. */
export function looksLikeCorosSchedule(text: string) {
  return /training schedule/i.test(text);
}

export async function syncCorosSchedule(todayKey: string, deps: CorosSyncDeps) {
  const range = getCorosSyncRange(todayKey);
  const text = await deps.callTool("queryTrainingSchedule", {
    startDate: toCorosDate(range.start),
    endDate: toCorosDate(range.end),
  });

  if (!looksLikeCorosSchedule(text)) {
    throw new Error(`Resposta inesperada do COROS: ${text.slice(0, 160) || "vazia"}`);
  }

  const workouts = buildCorosScheduleWorkouts({ text }).filter(
    (workout) => workout.date >= range.start && workout.date <= range.end,
  );
  const newDates = new Set(workouts.map((workout) => workout.date));

  for (const workout of workouts) await deps.save(workout);

  // Treino apagado ou movido no COROS: some daqui também. Só mexe no que veio do COROS, dentro da janela.
  const stale = (await deps.listSaved()).filter(
    (result) =>
      result.data?.source === "coros" &&
      result.date >= range.start &&
      result.date <= range.end &&
      !newDates.has(result.date),
  );
  for (const result of stale) await deps.remove(result.date);

  return { range, saved: workouts.length, removed: stale.length };
}

// ── Execução real (Redis + MCP) ──

export async function readCorosSyncStatus(): Promise<CorosSyncStatus | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(STATUS_KEY);
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as CorosSyncStatus;
  } catch {
    return null;
  }
}

async function writeStatus(status: CorosSyncStatus) {
  const redis = await getRedisClient();
  if (redis) await redis.set(STATUS_KEY, JSON.stringify(status));
}

export async function runCorosSync(todayKey: string, trigger: string): Promise<CorosSyncStatus> {
  const redis = await getRedisClient();
  if (!redis) throw new Error("Redis não configurado: a sincronização com o COROS precisa do Upstash.");

  // Uma sincronização por vez (cron, botão e abertura do site podem coincidir).
  const locked = await redis.set(LOCK_KEY, "1", { nx: true, ex: 120 });
  if (!locked) return { at: new Date().toISOString(), ok: false, trigger, error: "Já existe uma sincronização em andamento." };

  try {
    const { callCorosTool } = await import("./coros-mcp");
    const { clearQualityWorkoutsSnapshot } = await import("./quality-workouts-cache");
    const result = await syncCorosSchedule(todayKey, {
      callTool: callCorosTool,
      listSaved: getAllStructuredPlannedWorkouts,
      save: saveStructuredPlannedWorkout,
      remove: deleteStructuredPlannedWorkout,
    });
    await clearQualityWorkoutsSnapshot();
    const status: CorosSyncStatus = { at: new Date().toISOString(), ok: true, trigger, ...result };
    await writeStatus(status);
    return status;
  } catch (error) {
    const status: CorosSyncStatus = {
      at: new Date().toISOString(),
      ok: false,
      trigger,
      error: error instanceof Error ? error.message : "Falha ao sincronizar com o COROS.",
    };
    await writeStatus(status);
    return status;
  } finally {
    await redis.del(LOCK_KEY);
  }
}

/** Para chamar com after(): sincroniza só se estiver conectado e a última tiver ficado velha. */
export async function syncCorosIfStale(todayKey: string, now = Date.now()) {
  try {
    const { getCorosConnectionInfo } = await import("./coros-oauth");
    const { connected } = await getCorosConnectionInfo();
    if (!connected) return null;
    const last = await readCorosSyncStatus();
    if (last && now - Date.parse(last.at) < COROS_SYNC_STALE_MS) return null;
    return await runCorosSync(todayKey, "abertura do site");
  } catch {
    return null;
  }
}

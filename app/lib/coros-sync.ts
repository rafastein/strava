import { buildCorosScheduleWorkouts } from "./coros-planned-workouts";
import {
  extractCorosCourses,
  findCourseForWorkout,
  parseCorosCourseDescription,
  splitIntoWindows,
  type CorosCourseDetail,
} from "./coros-workout-details";
import {
  classifyStructuredWorkout,
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
  /** Treinos que vieram com as etapas detalhadas. */
  detailed?: number;
  /** Consultas de detalhe que falharam (o treino fica só com o resumo). */
  detailErrors?: number;
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

/**
 * O MCP do COROS devolve a agenda como string JSON: entre aspas e com "\n" escrito.
 * Desembrulha para texto com quebras de linha de verdade.
 */
export function decodeCorosToolText(text: string) {
  let decoded = text.trim();
  for (let i = 0; i < 2 && decoded.startsWith('"') && decoded.endsWith('"'); i += 1) {
    try {
      const parsed: unknown = JSON.parse(decoded);
      if (typeof parsed !== "string") break;
      decoded = parsed.trim();
    } catch {
      break;
    }
  }
  // Ainda com "\n" escrito e nenhuma quebra real: troca pelas quebras.
  if (!/\r?\n/.test(decoded) && decoded.includes("\\n")) {
    decoded = decoded.replaceAll("\\r\\n", "\n").replaceAll("\\n", "\n").replaceAll('\\"', '"');
  }
  return decoded;
}

// ── Detalhes de cada treino ──

function getScheduleIds(workout: StructuredPlannedWorkout) {
  const raw = workout.raw as { block?: unknown } | undefined;
  const lines = Array.isArray(raw?.block) ? raw.block.map(String) : [];
  const find = (pattern: RegExp) => lines.map((line) => pattern.exec(line)?.[1]).find(Boolean) ?? null;
  return { planId: find(/^plan id:\s*(\d+)/i), idInPlan: find(/^idinplan:\s*(\d+)/i) };
}

async function loadCourseDetails(
  workouts: StructuredPlannedWorkout[],
  range: { start: string; end: string },
  callTool: CorosSyncDeps["callTool"],
) {
  const courses: CorosCourseDetail[] = [];
  let errors = 0;
  const planIds = new Set<string>();
  const standalone: Array<{ date: string; idInPlan: string }> = [];

  for (const workout of workouts) {
    const { planId, idInPlan } = getScheduleIds(workout);
    if (planId) planIds.add(planId);
    else if (idInPlan) standalone.push({ date: workout.date, idInPlan });
  }

  // Treinos de plano: uma consulta por plano a cada 28 dias.
  for (const planId of planIds) {
    for (const window of splitIntoWindows(range.start, range.end)) {
      try {
        const text = decodeCorosToolText(
          await callTool("queryTrainingPlanDetails", {
            planId,
            startDay: toCorosDate(window.start),
            endDay: toCorosDate(window.end),
          }),
        );
        courses.push(...extractCorosCourses(text));
      } catch {
        errors += 1;
      }
    }
  }

  // Treinos avulsos da biblioteca: uma consulta por treino.
  for (const item of standalone) {
    try {
      const text = decodeCorosToolText(
        await callTool("queryScheduledWorkoutDetails", { date: toCorosDate(item.date), idInPlan: item.idInPlan }),
      );
      courses.push(...extractCorosCourses(text, item.date));
    } catch {
      errors += 1;
    }
  }

  return { courses, errors };
}

/**
 * Junta etapas, observações e percurso ao treino da agenda.
 * O tipo sai só do título e da distância: a observação da assessoria ("leve em razão da prova")
 * não pode transformar um fartlek em prova.
 */
export function applyCourseDetail(workout: StructuredPlannedWorkout, course: CorosCourseDetail | null) {
  const type = classifyStructuredWorkout({
    title: workout.title,
    distanceKm: workout.distanceKm,
    durationMin: workout.durationMin,
  });
  if (!course) return { ...workout, type };

  const detail = parseCorosCourseDescription(course.description);
  return {
    ...workout,
    type,
    steps: detail.steps.length ? detail.steps : workout.steps,
    description: detail.notes,
    route: detail.route,
    raw: {
      ...((workout.raw && typeof workout.raw === "object") ? workout.raw : {}),
      corosCourse: { name: course.name, description: course.description },
    },
  };
}

/** A resposta tem cara de agenda do COROS? Sem isso, nada é apagado. */
export function looksLikeCorosSchedule(text: string) {
  return /training schedule/i.test(text);
}

export async function syncCorosSchedule(todayKey: string, deps: CorosSyncDeps) {
  const range = getCorosSyncRange(todayKey);
  const text = decodeCorosToolText(
    await deps.callTool("queryTrainingSchedule", {
      startDate: toCorosDate(range.start),
      endDate: toCorosDate(range.end),
    }),
  );

  if (!looksLikeCorosSchedule(text)) {
    throw new Error(`Resposta inesperada do COROS: ${text.slice(0, 160) || "vazia"}`);
  }

  const workouts = buildCorosScheduleWorkouts({ text }).filter(
    (workout) => workout.date >= range.start && workout.date <= range.end,
  );

  // Datas na resposta, mas nenhum treino lido: formato mudou. Não grava nem apaga nada.
  const datesInText = text.match(/^\d{4}-\d{2}-\d{2}$/gm)?.length ?? 0;
  if (workouts.length === 0 && (datesInText > 0 || /Distance:/i.test(text))) {
    throw new Error(`O COROS mandou ${datesInText} dias com treino, mas nenhum foi lido. O formato da resposta mudou.`);
  }
  const newDates = new Set(workouts.map((workout) => workout.date));

  const { courses, errors: detailErrors } = await loadCourseDetails(workouts, range, deps.callTool);
  let detailed = 0;
  for (const workout of workouts) {
    const course = findCourseForWorkout(courses, workout.date, workout.title);
    if (course) detailed += 1;
    await deps.save(applyCourseDetail(workout, course));
  }

  // Treino apagado ou movido no COROS: some daqui também. Só mexe no que veio do COROS, dentro da janela.
  const stale = (await deps.listSaved()).filter(
    (result) =>
      result.data?.source === "coros" &&
      result.date >= range.start &&
      result.date <= range.end &&
      !newDates.has(result.date),
  );
  for (const result of stale) await deps.remove(result.date);

  return { range, saved: workouts.length, removed: stale.length, detailed, detailErrors };
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

/**
 * Cálculo de Carga de Treino — ATL / CTL / TSB
 *
 * Modelo baseado em Performance Management Chart (Banister et al.)
 * - CTL (Chronic Training Load)  = carga crônica, média exp. ~42 dias = "forma"
 * - ATL (Acute Training Load)    = carga recente, média exp. ~7 dias = "fadiga"
 * - TSB (Training Stress Balance) = CTL − ATL = "frescor"
 *
 * Métrica de esforço por treino:
 * - Com FC: TRIMP de Banister — tempo × FC normalizada × fator exponencial
 * - Sem FC: rTSS estimado por pace relativo ao limiar (T-pace do VDOT)
 *
 * Observação importante:
 * CTL precisa de uma janela de aquecimento para não começar artificialmente em zero.
 * Por isso a função calcula dias extras antes da janela exibida e só depois corta a série.
 *
 * Referências:
 *   Banister EW (1991) — Modeling elite athletic performance
 *   Coggan A (2003)    — rTSS derivation
 */

export type StravaActivityForLoad = {
  id: number;
  type: string;
  sport_type?: string;
  start_date_local: string;
  moving_time: number;        // segundos
  distance: number;           // metros
  average_heartrate?: number | null;
  suffer_score?: number | null;
};

export type DayLoad = {
  date: string;   // YYYY-MM-DD
  trimp: number;  // esforço do dia (0 se dia de descanso)
  atl: number;    // Acute Training Load
  ctl: number;    // Chronic Training Load
  tsb: number;    // Training Stress Balance = CTL - ATL
  status: "performance" | "optimal" | "maintaining" | "overreaching" | "recovery";
  ratio: number;  // ATL / CTL
};

export type TrainingLoadOptions = {
  thresholdPaceSecPerKm?: number;
  hrMax?: number;
  hrRest?: number;
  displayDays?: number;
  warmupDays?: number;
  timeZone?: string;
  today?: string;
};

// Constantes de tempo (em dias) para decaimento exponencial
const CTL_DAYS = 42;
const ATL_DAYS = 7;

const CTL_DECAY = 1 - Math.exp(-1 / CTL_DAYS); // ~0.0235
const ATL_DECAY = 1 - Math.exp(-1 / ATL_DAYS);  // ~0.1331

// Fallbacks usados apenas se o perfil do atleta não informar valores próprios.
const DEFAULT_THRESHOLD_PACE_SEC_PER_KM = 259;
const DEFAULT_HR_MAX = 185;
const DEFAULT_HR_REST = 50;
const DEFAULT_DISPLAY_DAYS = 90;
const DEFAULT_WARMUP_DAYS = 30;
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isRunActivity(activity: StravaActivityForLoad): boolean {
  return RUN_SPORT_TYPES.has(activity.type) ||
    Boolean(activity.sport_type && RUN_SPORT_TYPES.has(activity.sport_type));
}

function normalizeOptions(options: TrainingLoadOptions = {}) {
  const thresholdPaceSecPerKm =
    Number.isFinite(options.thresholdPaceSecPerKm) && options.thresholdPaceSecPerKm! > 0
      ? options.thresholdPaceSecPerKm!
      : DEFAULT_THRESHOLD_PACE_SEC_PER_KM;

  const hrMax =
    Number.isFinite(options.hrMax) && options.hrMax! > 0
      ? options.hrMax!
      : DEFAULT_HR_MAX;

  const hrRest =
    Number.isFinite(options.hrRest) && options.hrRest! >= 0
      ? options.hrRest!
      : DEFAULT_HR_REST;

  return {
    thresholdPaceSecPerKm,
    hrMax,
    hrRest,
    displayDays:
      Number.isFinite(options.displayDays) && options.displayDays! > 0
        ? Math.round(options.displayDays!)
        : DEFAULT_DISPLAY_DAYS,
    warmupDays:
      Number.isFinite(options.warmupDays) && options.warmupDays! >= 0
        ? Math.round(options.warmupDays!)
        : DEFAULT_WARMUP_DAYS,
    timeZone: options.timeZone || DEFAULT_TIME_ZONE,
    today: options.today,
  };
}

/**
 * Calcula o TRIMP de Banister para uma atividade com FC.
 * TRIMP = duração(min) × ΔHR × 0.64 × e^(1.92 × ΔHR)
 * onde ΔHR = (FC_média - FC_repouso) / (FC_max - FC_repouso)
 */
function trimpFromHR(
  movingTimeSec: number,
  avgHR: number,
  hrMax: number,
  hrRest: number
): number {
  if (movingTimeSec <= 0) return 0;
  if (hrMax <= hrRest) return 0;

  const durationMin = movingTimeSec / 60;
  const rawDeltaHR = (avgHR - hrRest) / (hrMax - hrRest);
  if (rawDeltaHR <= 0) return 0;

  // Pequena trava para evitar explosões por leitura óptica claramente acima da FC máx configurada.
  const deltaHR = Math.min(rawDeltaHR, 1.05);

  // Fórmula de Banister com constante b=1.92 para homens.
  return durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
}

/**
 * Calcula rTSS estimado por pace quando não há FC disponível.
 * rTSS = duração_h × IF² × 100
 * onde IF = pace_limiar / pace_médio.
 *
 * Este valor é usado apenas como fallback. Ele não é idêntico ao TRIMP de FC,
 * mas preserva uma estimativa razoável de carga quando o Strava não traz batimentos.
 */
function rTSSFromPace(
  movingTimeSec: number,
  distanceM: number,
  thresholdPaceSecPerKm = DEFAULT_THRESHOLD_PACE_SEC_PER_KM
): number {
  if (distanceM <= 0 || movingTimeSec <= 0) return 0;

  const paceSecPerKm = (movingTimeSec / distanceM) * 1000;
  if (paceSecPerKm <= 0) return 0;

  const intensityFactor = thresholdPaceSecPerKm / paceSecPerKm;
  const durationH = movingTimeSec / 3600;

  return durationH * intensityFactor * intensityFactor * 100;
}

/**
 * Calcula a carga de uma atividade.
 * Usa TRIMP por FC quando disponível; se não houver FC confiável, usa rTSS por pace.
 */
export function calcActivityTRIMP(
  activity: StravaActivityForLoad,
  options: TrainingLoadOptions = {}
): number {
  if (!isRunActivity(activity)) return 0;
  if (activity.moving_time <= 0) return 0;

  const { thresholdPaceSecPerKm, hrMax, hrRest } = normalizeOptions(options);

  if (
    typeof activity.average_heartrate === "number" &&
    Number.isFinite(activity.average_heartrate) &&
    activity.average_heartrate > hrRest + 10
  ) {
    return trimpFromHR(activity.moving_time, activity.average_heartrate, hrMax, hrRest);
  }

  return rTSSFromPace(
    activity.moving_time,
    activity.distance,
    thresholdPaceSecPerKm
  );
}

/**
 * Classifica o status do atleta com base no ratio ATL/CTL.
 */
function classifyStatus(ratio: number): DayLoad["status"] {
  if (ratio < 0.7)  return "recovery";
  if (ratio < 0.8)  return "performance";
  if (ratio <= 1.0) return "optimal";
  if (ratio <= 1.3) return "maintaining";
  return "overreaching";
}

/**
 * Dado um array de atividades, retorna a série temporal de ATL/CTL/TSB.
 *
 * A função calcula displayDays + warmupDays, mas retorna apenas displayDays.
 * O warmup evita que CTL/ATL comecem zerados exatamente no primeiro dia visível.
 *
 * O algoritmo usa média exponencial recursiva:
 *   CTL_hoje = CTL_ontem + (TRIMP_hoje - CTL_ontem) × k_ctl
 *   ATL_hoje = ATL_ontem + (TRIMP_hoje - ATL_ontem) × k_atl
 */
export function calcTrainingLoad(
  activities: StravaActivityForLoad[],
  options: TrainingLoadOptions = {}
): DayLoad[] {
  const normalized = normalizeOptions(options);
  const { displayDays, warmupDays, timeZone } = normalized;
  const totalDays = displayDays + warmupDays;

  // Monta mapa date → carga total do dia
  const loadByDate: Record<string, number> = {};

  for (const act of activities) {
    if (!isRunActivity(act)) continue;
    if (!act.start_date_local) continue;

    const date = act.start_date_local.slice(0, 10);
    const load = calcActivityTRIMP(act, normalized);
    loadByDate[date] = (loadByDate[date] ?? 0) + load;
  }

  const todayStr = normalized.today || dateKeyInTimeZone(new Date(), timeZone);
  const startStr = addDaysToDateKey(todayStr, -(totalDays - 1));

  const allDays: DayLoad[] = [];
  let ctl = 0;
  let atl = 0;

  for (let offset = 0; offset < totalDays; offset++) {
    const dateStr = addDaysToDateKey(startStr, offset);
    const trimp = loadByDate[dateStr] ?? 0;

    // Atualiza ATL e CTL com média exponencial.
    atl = atl + (trimp - atl) * ATL_DECAY;
    ctl = ctl + (trimp - ctl) * CTL_DECAY;

    const ratio = ctl > 0 ? atl / ctl : 0;

    allDays.push({
      date: dateStr,
      trimp: round1(trimp),
      atl: round1(atl),
      ctl: round1(ctl),
      tsb: round1(ctl - atl),
      ratio: round2(ratio),
      status: classifyStatus(ratio),
    });

  }

  return allDays.slice(-displayDays);
}

/**
 * Retorna apenas o estado atual (hoje).
 */
export function getCurrentLoad(days: DayLoad[]): DayLoad | null {
  return days[days.length - 1] ?? null;
}

/**
 * Labels e cores para cada status.
 */
export const STATUS_META: Record<
  DayLoad["status"],
  { label: string; color: string; description: string }
> = {
  performance:  { label: "Performance",   color: "#60a5fa", description: "Fadiga baixa em relação à base — bom para competir ou testar" },
  optimal:      { label: "Ótimo",         color: "#10b981", description: "Carga bem encaixada para desenvolvimento" },
  maintaining:  { label: "Manutenção",    color: "#f5a623", description: "Carga recente alta — bloco produtivo, mas precisa ser absorvido" },
  overreaching: { label: "Sobrecarga",    color: "#ef4444", description: "Carga recente muito acima da base — sinal de cautela, não diagnóstico" },
  recovery:     { label: "Recuperação",   color: "#a78bfa", description: "Carga baixa — descanso, polimento ou pouco estímulo recente" },
};

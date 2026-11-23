import { isRunActivity } from "./strava-activity";

/**
 * Cálculo de Carga de Treino — ATL / CTL / TSB
 *
 * Modelo do Performance Management Chart (Banister; Coggan):
 * - CTL (Chronic Training Load)  = média exponencial de 42 dias = "forma"
 * - ATL (Acute Training Load)    = média exponencial de 7 dias  = "fadiga"
 * - TSB (Training Stress Balance) = CTL de ontem − ATL de ontem  = "frescor para hoje"
 *   (convenção da TrainingPeaks: o treino de hoje só pesa no frescor de amanhã)
 *
 * Carga por treino, sempre na escala do TSS (1 h no limiar = 100):
 * - Com FC: hrTSS = TRIMP de Banister ÷ TRIMP de 1 h na FC de limiar × 100
 * - Sem FC: rTSS  = horas × IF² × 100, com IF = pace de limiar ÷ pace médio
 * Assim as duas fontes ficam comparáveis e as faixas de TSB (−10, −30, +25…) valem como na literatura.
 *
 * Ratio ATL/CTL nas faixas de Gabbett (2016): 0,8–1,3 produtiva; ≥ 1,5 pico de carga.
 * É tendência, não diagnóstico (Impellizzeri et al., 2020).
 *
 * O CTL precisa de aquecimento para não começar em zero: a função calcula dias extras
 * antes da janela exibida e só depois corta a série.
 *
 * Referências:
 *   Banister EW (1991) — Modeling elite athletic performance
 *   Coggan A (2003)    — TSS/rTSS
 *   Gabbett TJ (2016)  — The training-injury prevention paradox (BJSM)
 *   Impellizzeri FM et al. (2020) — ACWR: conceptual issues and fundamental pitfalls (IJSPP)
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

export type LoadStatus = "low" | "productive" | "caution" | "spike";

export type DayLoad = {
  date: string;   // YYYY-MM-DD
  load: number;   // carga do dia em pontos de TSS (0 se descanso)
  atl: number;    // Acute Training Load, ao fim do dia
  ctl: number;    // Chronic Training Load, ao fim do dia
  tsb: number;    // frescor para o dia = CTL − ATL do fim do dia anterior
  status: LoadStatus;
  ratio: number;  // ATL / CTL ao fim do dia
};

export type TrainingLoadOptions = {
  thresholdPaceSecPerKm?: number;
  hrMax?: number;
  hrRest?: number;
  /** FC de limiar (LTHR). Sem ela, estima-se 85% da reserva de FC. */
  lthr?: number;
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
const DEFAULT_WARMUP_DAYS = 90;
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
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

  // Sem LTHR medida: repouso + 85% da reserva (aproximação clássica do limiar).
  const lthr =
    Number.isFinite(options.lthr) && options.lthr! > hrRest && options.lthr! <= hrMax
      ? options.lthr!
      : Math.round(hrRest + 0.85 * (hrMax - hrRest));

  return {
    thresholdPaceSecPerKm,
    hrMax,
    hrRest,
    lthr,
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
 * hrTSS: o TRIMP do treino em relação ao TRIMP de 1 hora na FC de limiar, × 100.
 * Mesma escala do rTSS e do TSS (1 h no limiar = 100).
 */
export function hrTSSFromHR(movingTimeSec: number, avgHR: number, hrMax: number, hrRest: number, lthr: number): number {
  const reference = trimpFromHR(3600, lthr, hrMax, hrRest);
  if (reference <= 0) return 0;
  return (trimpFromHR(movingTimeSec, avgHR, hrMax, hrRest) / reference) * 100;
}

/**
 * Calcula a carga de uma atividade em pontos de TSS.
 * Usa hrTSS quando há FC; sem FC confiável, usa rTSS por pace.
 */
export function calcActivityLoad(
  activity: StravaActivityForLoad,
  options: TrainingLoadOptions = {}
): number {
  if (!isRunActivity(activity)) return 0;
  if (activity.moving_time <= 0) return 0;

  const { thresholdPaceSecPerKm, hrMax, hrRest, lthr } = normalizeOptions(options);

  if (
    typeof activity.average_heartrate === "number" &&
    Number.isFinite(activity.average_heartrate) &&
    activity.average_heartrate > hrRest + 10
  ) {
    return hrTSSFromHR(activity.moving_time, activity.average_heartrate, hrMax, hrRest, lthr);
  }

  return rTSSFromPace(
    activity.moving_time,
    activity.distance,
    thresholdPaceSecPerKm
  );
}

/**
 * Status pelo ratio ATL/CTL, nas faixas de Gabbett (2016).
 */
export function classifyStatus(ratio: number): LoadStatus {
  if (ratio < 0.8) return "low";
  if (ratio <= 1.3) return "productive";
  if (ratio < 1.5) return "caution";
  return "spike";
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
    const load = calcActivityLoad(act, normalized);
    loadByDate[date] = (loadByDate[date] ?? 0) + load;
  }

  const todayStr = normalized.today || dateKeyInTimeZone(new Date(), timeZone);
  const startStr = addDaysToDateKey(todayStr, -(totalDays - 1));

  const allDays: DayLoad[] = [];
  let ctl = 0;
  let atl = 0;

  for (let offset = 0; offset < totalDays; offset++) {
    const dateStr = addDaysToDateKey(startStr, offset);
    const load = loadByDate[dateStr] ?? 0;

    // Frescor do dia: como você acordou, antes do treino de hoje.
    const tsb = ctl - atl;

    // Atualiza ATL e CTL com média exponencial.
    atl = atl + (load - atl) * ATL_DECAY;
    ctl = ctl + (load - ctl) * CTL_DECAY;

    const ratio = ctl > 0 ? atl / ctl : 0;

    allDays.push({
      date: dateStr,
      load: round1(load),
      atl: round1(atl),
      ctl: round1(ctl),
      tsb: round1(tsb),
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
export const STATUS_META: Record<LoadStatus, { label: string; color: string; description: string }> = {
  low:        { label: "Carga baixa", color: "#a78bfa", description: "Carga recente abaixo da base: descanso, polimento ou pouco estímulo" },
  productive: { label: "Produtiva",   color: "#10b981", description: "Carga recente acompanhando a base: faixa para evoluir" },
  caution:    { label: "Atenção",     color: "#f5a623", description: "Carga recente bem acima da base: bloco forte, precisa ser absorvido" },
  spike:      { label: "Pico",        color: "#ef4444", description: "Salto de carga em relação à base: cautela nos próximos dias, não é diagnóstico" },
};

/**
 * Leitura do frescor (TSB, escala do TSS), nas faixas de uso corrente
 * (TrainingPeaks/Friel): abaixo de −10 cansado para competir; −10 a +10 transição; positivo, pronto.
 */
export function describeTsb(tsb: number): { label: string; text: string } {
  if (tsb > 25) {
    return { label: "Muito descansado", text: "Frescor alto por vários dias tende a custar forma. Bom para a véspera de prova, não como rotina." };
  }
  if (tsb >= 5) {
    return { label: "Pronto para prova", text: "Fadiga abaixo da base: a janela típica de prova ou de teste." };
  }
  if (tsb >= -10) {
    return { label: "Transição", text: "Nem carregado nem descansado. Normal de passagem: subindo para prova ou voltando de descanso." };
  }
  if (tsb >= -30) {
    return { label: "Em bloco de treino", text: "Fadiga acima da base, como esperado em semanas de construção. Cansado demais para render em prova." };
  }
  return { label: "Fadiga alta", text: "Fadiga muito acima da base. Vale olhar sono, pernas e FC de repouso antes de forçar." };
}

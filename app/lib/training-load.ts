/**
 * Cálculo de Carga de Treino — ATL / CTL / TSB
 *
 * Modelo baseado em Performance Management Chart (Banister et al.)
 * - CTL (Chronic Training Load)  = carga crônica, média exp. ~42 dias = "forma"
 * - ATL (Acute Training Load)    = carga recente, média exp. ~7 dias = "fadiga"
 * - TSB (Training Stress Balance) = CTL − ATL = "frescor"
 *
 * Métrica de esforço por treino: TRIMP (Training Impulse)
 * - Com FC: TRIMP de Banister — tempo × FC normalizada × fator exponencial
 * - Sem FC: rTSS estimado por pace relativo ao limiar (T-pace do VDOT)
 *
 * Referências:
 *   Banister EW (1991) — Modeling elite athletic performance
 *   Coggan A (2003)    — rTSS derivation
 */

export type StravaActivityForLoad = {
  id: number;
  type: string;
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

// Constantes de tempo (em dias) para decaimento exponencial
const CTL_DAYS = 42;
const ATL_DAYS = 7;

const CTL_DECAY = 1 - Math.exp(-1 / CTL_DAYS); // ~0.0233
const ATL_DECAY = 1 - Math.exp(-1 / ATL_DAYS);  // ~0.1331

// FC máxima e de repouso estimadas para normalização (podem ser sobrescritas)
const HR_MAX  = 185;
const HR_REST = 50;

/**
 * Calcula o TRIMP de Banister para uma atividade com FC.
 * TRIMP = duração(min) × ΔHR × 0.64 × e^(1.92 × ΔHR)
 * onde ΔHR = (FC_média - FC_repouso) / (FC_max - FC_repouso)
 */
function trimpFromHR(movingTimeSec: number, avgHR: number): number {
  const durationMin = movingTimeSec / 60;
  const deltaHR = (avgHR - HR_REST) / (HR_MAX - HR_REST);
  if (deltaHR <= 0) return 0;
  // Fórmula de Banister com constante b=1.92 para corrida
  return durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
}

/**
 * Calcula rTSS estimado por pace quando não há FC disponível.
 * rTSS = (duração_seg × pace_médio_ms) / (limiar_pace_ms × 3600) × 100
 * onde limiar_pace_ms = T-pace do VDOT do atleta
 *
 * T-pace padrão: 4:19/km = 259 s/km (do Coros — equivalente VDOT ~53)
 * Pode ser sobrescrito via parâmetro.
 */
function rTSSFromPace(
  movingTimeSec: number,
  distanceM: number,
  thresholdPaceSecPerKm = 259
): number {
  if (distanceM <= 0 || movingTimeSec <= 0) return 0;
  const paceSecPerKm = (movingTimeSec / distanceM) * 1000;
  // Intensidade relativa: quão duro em relação ao limiar
  const intensityFactor = thresholdPaceSecPerKm / paceSecPerKm;
  // rTSS = (duração_h) × IF² × 100
  const durationH = movingTimeSec / 3600;
  return durationH * intensityFactor * intensityFactor * 100;
}

/**
 * Calcula o TRIMP de uma atividade.
 * Usa FC quando disponível, senão cai para rTSS por pace.
 */
export function calcActivityTRIMP(
  activity: StravaActivityForLoad,
  thresholdPaceSecPerKm = 259
): number {
  if (activity.type !== "Run") return 0;
  if (activity.moving_time <= 0) return 0;

  if (activity.average_heartrate && activity.average_heartrate > 80) {
    return trimpFromHR(activity.moving_time, activity.average_heartrate);
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
 * Dado um array de atividades, retorna a série temporal de ATL/CTL/TSB
 * para cada dia desde a primeira atividade até hoje.
 *
 * O algoritmo usa média exponencial recursiva:
 *   CTL_hoje = CTL_ontem + (TRIMP_hoje - CTL_ontem) × k_ctl
 *   ATL_hoje = ATL_ontem + (TRIMP_hoje - ATL_ontem) × k_atl
 */
export function calcTrainingLoad(
  activities: StravaActivityForLoad[],
  thresholdPaceSecPerKm = 259,
  daysBack = 90
): DayLoad[] {
  // Monta mapa date → TRIMP total do dia
  const trimpByDate: Record<string, number> = {};

  for (const act of activities) {
    if (act.type !== "Run") continue;
    const date = act.start_date_local.slice(0, 10);
    const trimp = calcActivityTRIMP(act, thresholdPaceSecPerKm);
    trimpByDate[date] = (trimpByDate[date] ?? 0) + trimp;
  }

  // Gera lista de dias a cobrir
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysBack);

  const days: DayLoad[] = [];
  let ctl = 0;
  let atl = 0;

  const current = new Date(startDate);
  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    const trimp = trimpByDate[dateStr] ?? 0;

    // Atualiza ATL e CTL com média exponencial
    atl = atl + (trimp - atl) * ATL_DECAY;
    ctl = ctl + (trimp - ctl) * CTL_DECAY;

    const ratio = ctl > 0 ? atl / ctl : 0;

    days.push({
      date: dateStr,
      trimp: Math.round(trimp * 10) / 10,
      atl:   Math.round(atl * 10) / 10,
      ctl:   Math.round(ctl * 10) / 10,
      tsb:   Math.round((ctl - atl) * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      status: classifyStatus(ratio),
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
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
  performance:  { label: "Performance",   color: "#60a5fa", description: "Carga baixa — bom para competir ou testar" },
  optimal:      { label: "Ótimo",         color: "#10b981", description: "Zona ideal de desenvolvimento" },
  maintaining:  { label: "Manutenção",    color: "#f5a623", description: "Carga alta — absorvendo treino" },
  overreaching: { label: "Sobrecarga",    color: "#ef4444", description: "Carga muito alta — risco de overtraining" },
  recovery:     { label: "Recuperação",   color: "#a78bfa", description: "Carga baixa — destreinando ou descansando" },
};
import { formatBRDate, getActivityDate } from "../lib/date-utils";
import { readManualPredictions, type ManualPredictions } from "../lib/manual-predictions";
import {
  getStravaActivities,
  getStravaActivityDetail as fetchStravaActivityDetail,
  getStravaAthlete,
  type StravaActivitySummary,
  type StravaAthlete,
} from "../lib/strava-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StravaActivity = StravaActivitySummary;
export type Athlete = StravaAthlete;

export type HrZone = {
  name: string;
  min: number;
  max: number;
  color: string;
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

export async function getActivities(): Promise<StravaActivity[]> {
  return getStravaActivities({ perPage: 200, maxPages: 4 });
}

export async function getActivityDetail(
  id: number,
  accessToken?: string,
): Promise<StravaActivity | null> {
  return fetchStravaActivityDetail(id, accessToken);
}

export async function getAthlete(): Promise<Athlete | null> {
  return getStravaAthlete();
}

export async function getManualPredictions(): Promise<ManualPredictions> {
  const { data } = await readManualPredictions();
  return data;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatDate(dateString: string) {
  return formatBRDate(dateString);
}

export function formatFullDuration(seconds: number) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
}

export function formatDurationShort(seconds: number) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatSecondsPerKm(secondsPerKm: number) {
  const m = Math.floor(secondsPerKm / 60),
    s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DIST_MARATHON = 42.195;
export const PROJECTION_LONG_RUN_MIN_KM = 14; // mínimo para entrar na calculadora
export const STRONG_LONG_RUN_MIN_KM = 23; // marco inicial do ciclo Buenos Aires

// ─── Business logic ───────────────────────────────────────────────────────────

export function daysUntil(targetDate: Date) {
  return Math.ceil(
    (targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function marathonTimeFromPace(secondsPerKm: number) {
  return Math.round(secondsPerKm * DIST_MARATHON);
}

export function getCyclePhase(today: Date, raceDate: Date) {
  const days = daysUntil(raceDate);
  if (days > 140)
    return {
      name: "Base",
      description: "Consolidar consistência, volume e resistência geral.",
      color: "bg-sky-100 text-sky-700",
    };
  if (days > 70)
    return {
      name: "Construção",
      description:
        "Aumentar volume e trazer mais especificidade para a maratona.",
      color: "bg-amber-100 text-amber-700",
    };
  if (days > 21)
    return {
      name: "Pico",
      description: "Bloco mais específico, com longões fortes e sessões-chave.",
      color: "bg-orange-100 text-[#f5a623]",
    };
  return {
    name: "Taper",
    description: "Redução de carga para chegar descansado e afiado.",
    color: "bg-emerald-100 text-emerald-700",
  };
}

export function getIdealWeeklyVolume(daysToRace: number) {
  if (daysToRace > 140) return 50;
  if (daysToRace > 105) return 58;
  if (daysToRace > 70) return 65;
  if (daysToRace > 42) return 70;
  if (daysToRace > 21) return 62;
  return 40;
}

export function getReadinessStatus(params: {
  currentWeekKm: number;
  idealWeekKm: number;
  longestRunKm: number;
  longRuns28Plus: number;
}) {
  const ratio =
    params.idealWeekKm > 0 ? params.currentWeekKm / params.idealWeekKm : 0;
  if (ratio >= 0.9 && params.longestRunKm >= 28 && params.longRuns28Plus >= 2)
    return {
      label: "Verde",
      title: "Prontidão forte",
      description:
        "Seu ciclo mostra bons sinais de especificidade para sustentar a maratona.",
      card: "bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
    };
  if (ratio >= 0.7 && params.longestRunKm >= 24 && params.longRuns28Plus >= 1)
    return {
      label: "Amarelo",
      title: "Prontidão em construção",
      description:
        "O caminho está bom, mas ainda faltam mais base e longões específicos.",
      card: "bg-amber-50 border-amber-200",
      dot: "bg-amber-500",
      text: "text-amber-700",
    };
  return {
    label: "Vermelho",
    title: "Prontidão baixa",
    description:
      "Ainda falta especificidade de maratona para sustentar o alvo com segurança.",
    card: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    text: "text-red-700",
  };
}

export function predictFromHalf(half: StravaActivity | null) {
  if (!half) return null;
  return Math.round(half.moving_time * Math.pow(DIST_MARATHON / 21.0975, 1.06));
}

export function predictFromLongRun(longestRun: StravaActivity | null) {
  if (!longestRun) return null;
  const km = longestRun.distance / 1000;
  if (km < STRONG_LONG_RUN_MIN_KM) return null;
  const pace = longestRun.moving_time / km;
  const adjusted = km >= 30 ? pace + 12 : km >= 28 ? pace + 16 : pace + 22;
  return marathonTimeFromPace(adjusted);
}

export type SitePredictionModel = {
  seconds: number | null;
  confidenceLabel: "Alta" | "Média" | "Baixa";
  caption: string;
  avgWeeklyKm: number;
  longRunKm: number;
  longRunPenaltySeconds: number;
  volumePenaltySeconds: number;
  totalPenaltySeconds: number;
};

export function getLongRunPenaltySeconds(longestRun: StravaActivity | null) {
  const km = longestRun ? longestRun.distance / 1000 : 0;

  if (km >= 32) return 0;
  if (km >= 30) return 3 * 60;
  if (km >= 28) return 6 * 60;
  if (km >= 26) return 10 * 60;
  if (km >= STRONG_LONG_RUN_MIN_KM) return 14 * 60;
  if (km >= 21) return 20 * 60;

  return 25 * 60;
}

export function getVolumePenaltySeconds(avgWeeklyKm: number) {
  if (avgWeeklyKm >= 65) return -3 * 60;
  if (avgWeeklyKm >= 55) return 0;
  if (avgWeeklyKm >= 45) return 5 * 60;
  if (avgWeeklyKm >= 35) return 10 * 60;
  if (avgWeeklyKm >= 25) return 16 * 60;

  return 22 * 60;
}

export function getProjectionConfidenceLabel(longRunKm: number, avgWeeklyKm: number) {
  if (longRunKm >= 30 && avgWeeklyKm >= 50) return "Alta" as const;
  if (longRunKm >= 26 && avgWeeklyKm >= 40) return "Média" as const;
  return "Baixa" as const;
}

function formatPenaltyMinutes(seconds: number) {
  const minutes = Math.round(Math.abs(seconds) / 60);
  if (seconds < 0) return `-${minutes} min`;
  if (seconds > 0) return `+${minutes} min`;
  return "0 min";
}

export function predictBySiteModelDetails(params: {
  bestHalf: StravaActivity | null;
  longestRun: StravaActivity | null;
  weeklyData: { label: string; distanceKm: number }[];
}): SitePredictionModel {
  const halfP = predictFromHalf(params.bestHalf);
  const longRunP = predictFromLongRun(params.longestRun);
  const avgWeekly = params.weeklyData.length
    ? params.weeklyData.reduce((s, x) => s + x.distanceKm, 0) /
      params.weeklyData.length
    : 0;
  const longRunKm = params.longestRun ? params.longestRun.distance / 1000 : 0;
  const longRunPenaltySeconds = getLongRunPenaltySeconds(params.longestRun);
  const volumePenaltySeconds = getVolumePenaltySeconds(avgWeekly);
  const confidenceLabel = getProjectionConfidenceLabel(longRunKm, avgWeekly);

  const rawPenaltySeconds = longRunPenaltySeconds + volumePenaltySeconds;
  const totalPenaltySeconds = Math.min(
    Math.max(rawPenaltySeconds, -3 * 60),
    28 * 60,
  );

  const longRunStatus =
    longRunKm >= STRONG_LONG_RUN_MIN_KM
      ? `longão ${longRunKm.toFixed(1)} km`
      : `sem longão acima de ${STRONG_LONG_RUN_MIN_KM} km`;
  const caption = `confiança ${confidenceLabel.toLowerCase()} · ${longRunStatus} · ajuste ${formatPenaltyMinutes(totalPenaltySeconds)}`;

  if (halfP) {
    return {
      seconds: halfP + totalPenaltySeconds,
      confidenceLabel,
      caption,
      avgWeeklyKm: avgWeekly,
      longRunKm,
      longRunPenaltySeconds,
      volumePenaltySeconds,
      totalPenaltySeconds,
    };
  }

  if (longRunP) {
    const volumeOnlyPenalty = Math.min(Math.max(volumePenaltySeconds, 0), 12 * 60);
    return {
      seconds: longRunP + volumeOnlyPenalty,
      confidenceLabel,
      caption: `confiança ${confidenceLabel.toLowerCase()} · sem meia recente · ajuste ${formatPenaltyMinutes(volumeOnlyPenalty)}`,
      avgWeeklyKm: avgWeekly,
      longRunKm,
      longRunPenaltySeconds,
      volumePenaltySeconds,
      totalPenaltySeconds: volumeOnlyPenalty,
    };
  }

  return {
    seconds: null,
    confidenceLabel,
    caption: "aguardando meia ou longão válido",
    avgWeeklyKm: avgWeekly,
    longRunKm,
    longRunPenaltySeconds,
    volumePenaltySeconds,
    totalPenaltySeconds,
  };
}

export function predictBySiteModel(params: {
  bestHalf: StravaActivity | null;
  longestRun: StravaActivity | null;
  weeklyData: { label: string; distanceKm: number }[];
}) {
  return predictBySiteModelDetails(params).seconds;
}

export function getHrZoneForBpm(bpm: number, zones: HrZone[]): HrZone | null {
  return zones.find((z) => bpm >= z.min && bpm <= z.max) ?? null;
}
export function getHrPctMax(bpm: number, hrMax: number) {
  return Math.round((bpm / hrMax) * 100);
}

export function buildMarathonAlerts(params: {
  hasPlan: boolean;
  plannedWeekKm: number;
  currentWeekKm: number;
  adherencePct: number;
  plannedLongRunKm: number;
  currentWeekLongestRunKm: number;
  todayStatus: string;
  marathonPaceMin: number | null;
  vdot: number | null;
  goalPaceSecPerKm: number;
}) {
  const alerts: { title: string; text: string; tone: string }[] = [];
  if (!params.hasPlan) {
    alerts.push({
      title: "Planejamento ausente",
      text: "Carregue uma planilha do SisRUN para comparar a semana atual.",
      tone: "bg-white/[0.03] text-white/60",
    });
    return alerts;
  }
  if (params.adherencePct < 70)
    alerts.push({
      title: "Semana abaixo da meta",
      text: `Você executou ${params.currentWeekKm.toFixed(1)} km de ${params.plannedWeekKm.toFixed(1)} km planejados.`,
      tone: "bg-red-50 text-red-700",
    });
  else if (params.adherencePct < 90)
    alerts.push({
      title: "Semana em construção",
      text: `Boa evolução, mas ainda faltam ${Math.max(params.plannedWeekKm - params.currentWeekKm, 0).toFixed(1)} km para a meta da semana.`,
      tone: "bg-amber-50 text-amber-700",
    });
  else
    alerts.push({
      title: "Volume da semana bem encaminhado",
      text: "A execução está acompanhando bem o planejado do SisRUN.",
      tone: "bg-emerald-50 text-emerald-700",
    });
  if (
    params.plannedLongRunKm > 0 &&
    params.currentWeekLongestRunKm < params.plannedLongRunKm
  )
    alerts.push({
      title: "Longão ainda não cumprido",
      text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`,
      tone: "bg-amber-50 text-amber-700",
    });
  else if (params.plannedLongRunKm > 0)
    alerts.push({
      title: "Longão da semana cumprido",
      text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`,
      tone: "bg-emerald-50 text-emerald-700",
    });
  if (params.todayStatus === "Pendente")
    alerts.push({
      title: "Treino de hoje pendente",
      text: "A sessão de hoje ainda não aparece como cumprida no Strava.",
      tone: "bg-amber-50 text-amber-700",
    });
  if (params.marathonPaceMin && params.vdot) {
    const gap = params.goalPaceSecPerKm - params.marathonPaceMin;
    if (gap > 20)
      alerts.push({
        title: "Pace-alvo conservador vs. VO2max",
        text: `Seu VDOT ${params.vdot.toFixed(1)} indica potencial para ${formatSecondsPerKm(params.marathonPaceMin)} na maratona. Considere ajustar a meta conforme o ciclo avança.`,
        tone: "bg-[rgba(59,130,246,0.1)] text-[#93c5fd]",
      });
  }
  return alerts;
}

// ─── Helpers para a calculadora ───────────────────────────────────────────────

export function calculateEfficiency(
  km: number,
  timeSec: number,
  hr: number | null | undefined,
  elev: number,
): number | null {
  if (!km || !timeSec || !hr) return null;
  const speed = km / (timeSec / 3600);
  const elevFactor = elev > 0 ? 1 + elev / (km * 100) : 1;
  return ((speed * elevFactor) / hr) * 1000;
}

export function buildProjectionLongRuns(
  runs: StravaActivity[],
  enriched: StravaActivity[],
) {
  const map = new Map(enriched.map((r) => [r.id, r]));
  return runs
    .filter((a) => a.distance / 1000 >= PROJECTION_LONG_RUN_MIN_KM)
    .sort(
      (a, b) =>
        new Date(getActivityDate(a)).getTime() -
        new Date(getActivityDate(b)).getTime(),
    )
    .map((run) => {
      const e = map.get(run.id) ?? run;
      const km = run.distance / 1000;
      const fc = e.average_heartrate ? Math.round(e.average_heartrate) : null;
      return {
        date: getActivityDate(run),
        km: Number(km.toFixed(2)),
        paceSeconds: Math.round(run.moving_time / km),
        efficiency: calculateEfficiency(
          km,
          run.moving_time,
          e.average_heartrate,
          run.total_elevation_gain ?? 0,
        ),
        fc,
      };
    });
}

// ─── UI Components ────────────────────────────────────────────────────────────

export function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <h3 className="mt-2 text-3xl font-bold text-white/60">{value}</h3>
    </div>
  );
}

export function ProjectionCard({
  title,
  value,
  caption,
  highlight = false,
  badge,
}: {
  title: string;
  value: string;
  caption: string;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex min-h-[92px] flex-col items-center justify-center rounded-[18px] border px-3 py-3 text-center ${
        highlight
          ? "border-orange-300/25 bg-[rgba(245,166,35,0.09)]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex min-h-[16px] items-center justify-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/36">
          {title}
        </p>
        {badge && (
          <span className="shrink-0 rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-[9px] font-medium text-[#93c5fd]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-[17px] font-semibold leading-none tracking-[-0.02em] text-white/90">
        {value}
      </p>
      <p
        className="mt-1.5 max-w-full text-[10.5px] leading-snug text-white/42"
        style={{ overflowWrap: "anywhere" }}
      >
        {caption}
      </p>
    </div>
  );
}

export function HrZoneBadge({
  bpm,
  zones,
  hrMax,
}: {
  bpm: number;
  zones: HrZone[];
  hrMax: number;
}) {
  const zone = getHrZoneForBpm(bpm, zones);
  const pct = getHrPctMax(bpm, hrMax);
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: zone?.color ?? "#888" }}
      >
        {zone?.name ?? "—"}
      </span>
      <span className="text-xs text-white/60">{pct}% FCmáx</span>
    </div>
  );
}


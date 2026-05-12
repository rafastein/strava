export const dynamic = "force-dynamic";

import { formatBRDate, getBRDate, getActivityDate } from "../lib/date-utils";
import path from "path";
import Link from "next/link";
import Navbar from "../components/Navbar";
import ManualPredictionForm from "../components/ManualPredictionForm";
import MarathonProjection from "../components/MarathonProjection";
import RaceCountdown from "../components/RaceCountdown";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import WeeklyPlanVsActualChart from "../components/WeeklyPlanVsActualChart";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { getDynamicAthleteProfile, formatPrTime } from "../lib/strava-prs";
import { trainingPacesFromVdot } from "../lib/vdot";
import {
  getSisrunData,
  getCurrentWeek,
  getTodaySisrunRow,
  getTodayStravaKm,
  getCurrentWeekStravaKm,
  getCurrentWeekLongestRunKm,
  getWeekStart,
  formatWeekLabel,
  buildWeeklyComparison,
  type SisrunWeek,
} from "../lib/sisrun-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date_local: string;
  average_heartrate?: number;
  max_heartrate?: number;
};

type Athlete = {
  id: number;
  firstname: string;
  lastname: string;
  city: string | null;
  state: string | null;
  profile_medium: string | null;
  profile: string | null;
};

type ManualPredictions = {
  stravaMarathonPrediction: string;
};

type HrZone = {
  name: string;
  min: number;
  max: number;
  color: string;
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];
    const res = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=80",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn("Falha Strava activities:", res.status);
      return [];
    }
    return res.json();
  } catch (error) {
    console.warn("Erro ao buscar atividades:", error);
    return [];
  }
}

async function getActivityDetail(
  id: number,
  accessToken: string,
): Promise<StravaActivity | null> {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAthlete(): Promise<Athlete | null> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return null;
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("Falha Strava athlete:", res.status);
      return null;
    }
    return res.json();
  } catch (error) {
    console.warn("Erro ao buscar atleta:", error);
    return null;
  }
}

async function getManualPredictions(): Promise<ManualPredictions> {
  const { default: fs } = await import("fs/promises");
  const filePath = path.join(process.cwd(), "data", "manual-predictions.json");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { stravaMarathonPrediction: "03:49:00" };
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  return formatBRDate(dateString);
}

function formatFullDuration(seconds: number) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
}

function formatDurationShort(seconds: number) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatSecondsPerKm(secondsPerKm: number) {
  const m = Math.floor(secondsPerKm / 60),
    s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIST_MARATHON = 42.195;
const PROJECTION_LONG_RUN_MIN_KM = 18; // mínimo para entrar na calculadora

// ─── Business logic ───────────────────────────────────────────────────────────

function daysUntil(targetDate: Date) {
  return Math.ceil(
    (targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
  );
}

function marathonTimeFromPace(secondsPerKm: number) {
  return Math.round(secondsPerKm * DIST_MARATHON);
}

function getCyclePhase(today: Date, raceDate: Date) {
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

function getIdealWeeklyVolume(daysToRace: number) {
  if (daysToRace > 140) return 50;
  if (daysToRace > 105) return 58;
  if (daysToRace > 70) return 65;
  if (daysToRace > 42) return 70;
  if (daysToRace > 21) return 62;
  return 40;
}

function getReadinessStatus(params: {
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

function predictFromHalf(half: StravaActivity | null) {
  if (!half) return null;
  return Math.round(half.moving_time * Math.pow(DIST_MARATHON / 21.0975, 1.06));
}

function predictFromLongRun(longestRun: StravaActivity | null) {
  if (!longestRun) return null;
  const km = longestRun.distance / 1000;
  if (km < 24) return null;
  const pace = longestRun.moving_time / km;
  const adjusted = km >= 30 ? pace + 12 : km >= 28 ? pace + 16 : pace + 22;
  return marathonTimeFromPace(adjusted);
}

function predictBySiteModel(params: {
  bestHalf: StravaActivity | null;
  longestRun: StravaActivity | null;
  weeklyData: { label: string; distanceKm: number }[];
}) {
  const halfP = predictFromHalf(params.bestHalf);
  const longRunP = predictFromLongRun(params.longestRun);
  const avgWeekly = params.weeklyData.length
    ? params.weeklyData.reduce((s, x) => s + x.distanceKm, 0) /
      params.weeklyData.length
    : 0;
  if (halfP && longRunP) {
    let base = Math.round((halfP + longRunP) / 2);
    if (avgWeekly >= 60) base -= 120;
    else if (avgWeekly < 40) base += 180;
    return base;
  }
  if (halfP) {
    let base = halfP;
    if (avgWeekly >= 60) base -= 90;
    else if (avgWeekly < 40) base += 180;
    return base;
  }
  if (longRunP) return longRunP;
  return null;
}

function getHrZoneForBpm(bpm: number, zones: HrZone[]): HrZone | null {
  return zones.find((z) => bpm >= z.min && bpm <= z.max) ?? null;
}
function getHrPctMax(bpm: number, hrMax: number) {
  return Math.round((bpm / hrMax) * 100);
}

function buildMarathonAlerts(params: {
  hasPlan: boolean;
  plannedWeekKm: number;
  currentWeekKm: number;
  adherencePct: number;
  plannedLongRunKm: number;
  currentWeekLongestRunKm: number;
  todayStatus: string;
  marathonPaceMin: number | null;
  vdot: number | null;
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
    const gap = 320 - params.marathonPaceMin;
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

function calculateEfficiency(
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

function buildProjectionLongRuns(
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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <h3 className="mt-2 text-3xl font-bold text-white/60">{value}</h3>
    </div>
  );
}

function ProjectionCard({
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
      className={`rounded-2xl border p-4 ${highlight ? "border-orange-300/25 bg-[rgba(245,166,35,0.1)]" : "border-white/10 bg-white/[0.035]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {title}
        </p>
        {badge && (
          <span className="shrink-0 rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-xs font-medium text-[#93c5fd]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold leading-tight text-white/80">{value}</p>
      <p className="mt-1 text-xs leading-snug text-white/50">{caption}</p>
    </div>
  );
}

function HrZoneBadge({
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
        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: zone?.color ?? "#888" }}
      >
        {zone?.name ?? "—"}
      </span>
      <span className="text-xs text-white/60">{pct}% FCmáx</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BuenosAiresPage() {
  const accessToken = await getValidStravaAccessToken();

  const [athlete, activities, manualPredictions, sisrunData, athleteProfile] =
    await Promise.all([
      getAthlete(),
      getActivities(),
      getManualPredictions(),
      getSisrunData(),
      accessToken
        ? getDynamicAthleteProfile(accessToken)
        : Promise.resolve(null),
    ]);

  const sisrunWeek = getCurrentWeek(sisrunData) as SisrunWeek | null;
  const todaySisrunRow = getTodaySisrunRow(sisrunData);

  const marathonGoal = {
    raceName: "Maratona de Buenos Aires",
    date: new Date("2026-09-20T06:00:00"),
    targetPaceSecondsPerKm: 320,
    targetWeeklyKm: 65,
    targetLongRunKm: 30,
  };

  const today = new Date();
  const daysToRace = daysUntil(marathonGoal.date);
  const cyclePhase = getCyclePhase(today, marathonGoal.date);
  const runs = activities.filter((a) => a.type === "Run");

  const longestRun = runs.length
    ? runs.reduce((m, a) => (a.distance > m.distance ? a : m))
    : null;
  const longestRunKm = longestRun ? longestRun.distance / 1000 : 0;

  const weekMap = new Map<string, { label: string; distanceKm: number }>();
  runs.forEach((a) => {
    const date = getBRDate(getActivityDate(a));
    if (!date) return;
    const ws = getWeekStart(date);
    const key = ws.toISOString();
    const cur = weekMap.get(key);
    if (cur) cur.distanceKm += a.distance / 1000;
    else
      weekMap.set(key, {
        label: formatWeekLabel(ws),
        distanceKm: a.distance / 1000,
      });
  });

  const weeklyData = Array.from(weekMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-10)
    .map(([, v]) => ({
      label: v.label,
      distanceKm: Number(v.distanceKm.toFixed(1)),
    }));

  const currentWeekKm = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm = getTodayStravaKm(activities);
  const plannedWeekKm = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct =
    plannedWeekKm > 0 ? (currentWeekKm / plannedWeekKm) * 100 : 0;
  const weeklyGoalKm = marathonGoal.targetWeeklyKm;
  const weeklyProgress = Math.min((currentWeekKm / weeklyGoalKm) * 100, 100);
  const targetPaceLabel = formatSecondsPerKm(
    marathonGoal.targetPaceSecondsPerKm,
  );
  const targetPredictionSeconds = marathonTimeFromPace(
    marathonGoal.targetPaceSecondsPerKm,
  );
  const longRuns28Plus = runs.filter((a) => a.distance >= 28000);
  const idealWeekKm = getIdealWeeklyVolume(daysToRace);
  const weekVsIdealDifference = currentWeekKm - idealWeekKm;

  const readiness = getReadinessStatus({
    currentWeekKm,
    idealWeekKm,
    longestRunKm,
    longRuns28Plus: longRuns28Plus.length,
  });

  const bestHalf =
    runs
      .filter((a) => {
        const km = a.distance / 1000;
        return km >= 20 && km <= 22;
      })
      .sort((a, b) => a.moving_time - b.moving_time)[0] ?? null;

  // Provas para plotar no gráfico de projeção (meias + 10km com pace confiável)
  const racePointsForProjection = runs
    .filter((a) => {
      const km = a.distance / 1000;
      return km >= 9.5 && km <= 22.5;
    })
    .map((a) => ({
      date: a.start_date_local,
      name: a.name,
      distanceKm: a.distance / 1000,
      paceSeconds: Math.round(a.moving_time / (a.distance / 1000)),
    }))
    .filter((r) => r.paceSeconds > 200 && r.paceSeconds < 500)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const predictedFromHalf = predictFromHalf(bestHalf);
  const predictedFromLongRun = predictFromLongRun(longestRun);
  const predictedBySite = predictBySiteModel({
    bestHalf,
    longestRun,
    weeklyData,
  });

  // Projeção dinâmica pelo VDOT calculado dos PRs do Strava
  const vdot = athleteProfile?.vdot ?? null;
  const vo2max = athleteProfile?.vo2max ?? null;
  const marathonPaces = athleteProfile?.paces.marathon ?? null;
  const predictedFromVdotRange = marathonPaces
    ? {
        min: marathonTimeFromPace(marathonPaces.min),
        max: marathonTimeFromPace(marathonPaces.max),
      }
    : null;

  // Paces de treino corrigidos pela fórmula de Daniels (% do VDOT)
  const trainingPaces = vdot ? trainingPacesFromVdot(vdot) : null;

  const recentLongRunsBase = runs
    .filter((a) => a.distance >= 18000)
    .sort(
      (a, b) =>
        new Date(getActivityDate(b)).getTime() -
        new Date(getActivityDate(a)).getTime(),
    )
    .slice(0, 5);

  const recentLongRuns = await Promise.all(
    recentLongRunsBase.map(async (run) => {
      if (run.average_heartrate) return run;
      if (accessToken) {
        const d = await getActivityDetail(run.id, accessToken);
        if (d?.average_heartrate) return { ...run, ...d };
      }
      return run;
    }),
  );

  // ── Dados para a calculadora de projeção ──────────────────────────────────
  const projRunsBase = runs
    .filter((a) => a.distance / 1000 >= PROJECTION_LONG_RUN_MIN_KM)
    .sort(
      (a, b) =>
        new Date(getActivityDate(a)).getTime() -
        new Date(getActivityDate(b)).getTime(),
    );

  const projRunsEnriched = await Promise.all(
    projRunsBase.map(async (run) => {
      if (run.average_heartrate) return run;
      if (accessToken) {
        const d = await getActivityDetail(run.id, accessToken);
        if (d?.average_heartrate) return { ...run, ...d };
      }
      return run;
    }),
  );

  const projectionLongRuns = buildProjectionLongRuns(
    projRunsBase,
    projRunsEnriched,
  );
  const weeksToRace = Math.max(1, Math.ceil(daysToRace / 7));
  // ──────────────────────────────────────────────────────────────────────────

  const todayStatus = !todaySisrunRow
    ? "Sem treino previsto hoje"
    : todayStravaKm <= 0
      ? "Pendente"
      : todaySisrunRow.plannedDistanceKm > 0 &&
          todayStravaKm >= todaySisrunRow.plannedDistanceKm
        ? "Concluído"
        : "Parcial";

  const alerts = buildMarathonAlerts({
    hasPlan: Boolean(sisrunWeek),
    plannedWeekKm,
    currentWeekKm,
    adherencePct: weeklyAdherencePct,
    plannedLongRunKm: sisrunWeek?.longRunPlannedKm ?? 0,
    currentWeekLongestRunKm,
    todayStatus,
    marathonPaceMin: marathonPaces?.min ?? null,
    vdot,
  });
  const hrZones: HrZone[] = [];
  const hrMax = 184;
  const weeklyAdherenceForUi = Number.isFinite(weeklyAdherencePct)
    ? Math.min(weeklyAdherencePct, 100)
    : 0;

  return (
    <main
      className="min-h-screen"
      style={{ background: "#0d0d0d", fontFamily: "'DM Sans', sans-serif" }}
    >
      <Navbar />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .ba-page { max-width: 1180px; margin: 0 auto; padding: 2.4rem 1.5rem 4rem; }
        .ba-hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 2rem; align-items: stretch; }
        .ba-eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #f5a623; }
        .ba-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(3rem, 5.4vw, 4.85rem); line-height: .94; letter-spacing: .018em; color: #fff; }
        .ba-card { background: linear-gradient(180deg, rgba(255,255,255,.052), rgba(255,255,255,.026)); border: 1px solid rgba(255,255,255,.09); border-radius: 22px; box-shadow: 0 18px 60px rgba(0,0,0,.22); }
        .ba-card-soft { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.075); border-radius: 18px; }
        .ba-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.38); }
        .ba-value { font-family: 'Bebas Neue', sans-serif; letter-spacing: .035em; color: #fff; line-height: .95; }
        .ba-muted { color: rgba(255,255,255,.56); }
        .ba-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: .9rem; }
        .ba-week { display: grid; grid-template-columns: .78fr 1.22fr; gap: 1rem; }
        .ba-two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .ba-progress { height: 8px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
        .ba-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #f5a623, #ff6b00); }
        .ba-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .75rem; border-radius: 999px; font-size: 12px; font-weight: 700; text-decoration: none; }
        .ba-pill-orange { background: #f5a623; color: #111; }
        .ba-pill-dark { background: rgba(255,255,255,.06); color: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.08); }
        .ba-race-glow { position: absolute; inset: -120px -120px auto auto; width: 520px; height: 520px; border-radius: 50%; background: radial-gradient(circle, rgba(245,166,35,.16), transparent 68%); pointer-events: none; }
        @media (max-width: 1020px) { .ba-hero, .ba-week, .ba-two { grid-template-columns: 1fr; } .ba-grid-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .ba-page { padding: 2rem 1rem 3rem; } .ba-grid-4 { grid-template-columns: 1fr; } .ba-title { font-size: 3.2rem; } }
      `}</style>

      <div className="ba-page">
        <section className="ba-hero" style={{ marginBottom: "2.2rem" }}>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "2rem",
              borderRadius: 28,
              background:
                "linear-gradient(135deg, rgba(245,166,35,.18), rgba(255,255,255,.03) 42%, rgba(255,255,255,.015))",
              border: "1px solid rgba(245,166,35,.18)",
            }}
          >
            <div className="ba-race-glow" />
            <div style={{ position: "relative" }}>
              <p className="ba-eyebrow">Road to Buenos Aires · 20/09</p>
              <h1 className="ba-title" style={{ marginTop: ".85rem" }}>
                Maratona de
                <br />
                Buenos Aires
              </h1>
              <p
                style={{
                  maxWidth: 600,
                  marginTop: ".9rem",
                  fontSize: 15,
                  lineHeight: 1.65,
                }}
                className="ba-muted"
              >
                Central do ciclo: volume, longão, aderência semanal, VDOT,
                projeções e sinais de prontidão para a prova-alvo.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: ".7rem",
                  flexWrap: "wrap",
                  marginTop: "1.4rem",
                }}
              >
                <Link href="/" className="ba-pill ba-pill-orange">
                  Dashboard →
                </Link>
                <Link href="/longoes" className="ba-pill ba-pill-dark">
                  Ver longões
                </Link>
                <span className="ba-pill ba-pill-dark">
                  Meta {targetPaceLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="ba-card" style={{ padding: "1.35rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div>
                <p className="ba-eyebrow">Contagem regressiva</p>
                <p className="ba-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Buenos Aires · prova-alvo
                </p>
              </div>
              <span
                style={{
                  border: "1px solid rgba(245,166,35,.25)",
                  color: "#f5a623",
                  background: "rgba(245,166,35,.09)",
                  padding: ".35rem .65rem",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                42K
              </span>
            </div>
            <div style={{ margin: ".75rem 0 1.1rem" }}>
              <RaceCountdown
                targetDate="2026-09-20T06:00:00-03:00"
                raceName="Buenos Aires"
              />
            </div>
            <div
              className="ba-grid-4"
              style={{
                gridTemplateColumns: "repeat(3, 1fr)",
                marginTop: "1rem",
              }}
            >
              <div className="ba-card-soft" style={{ padding: "1rem" }}>
                <p className="ba-label">Pace-alvo</p>
                <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
                  {targetPaceLabel.replace("/km", "")}
                </p>
                <p className="ba-muted" style={{ fontSize: 12 }}>
                  /km
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: "1rem" }}>
                <p className="ba-label">Projetado</p>
                <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
                  {formatDurationShort(targetPredictionSeconds)}
                </p>
                <p className="ba-muted" style={{ fontSize: 12 }}>
                  tempo-alvo
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: "1rem" }}>
                <p className="ba-label">Fase</p>
                <p className="ba-value" style={{ fontSize: 28, marginTop: 10 }}>
                  {cyclePhase.name}
                </p>
                <p className="ba-muted" style={{ fontSize: 12 }}>
                  do ciclo
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="ba-grid-4" style={{ marginBottom: "1rem" }}>
          <div className="ba-card" style={{ padding: "1.2rem" }}>
            <p className="ba-label">Semana planejada</p>
            <p className="ba-value" style={{ fontSize: 34, marginTop: 10 }}>
              {sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "—"}
            </p>
          </div>
          <div
            className="ba-card"
            style={{ padding: "1.2rem", borderColor: "rgba(245,166,35,.22)" }}
          >
            <p className="ba-label">Executado</p>
            <p
              className="ba-value"
              style={{ fontSize: 34, marginTop: 10, color: "#f5a623" }}
            >
              {currentWeekKm.toFixed(1)} km
            </p>
          </div>
          <div className="ba-card" style={{ padding: "1.2rem" }}>
            <p className="ba-label">Aderência</p>
            <p className="ba-value" style={{ fontSize: 34, marginTop: 10 }}>
              {sisrunWeek
                ? `${Math.min(weeklyAdherencePct, 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>
          <div className="ba-card" style={{ padding: "1.2rem" }}>
            <p className="ba-label">Longão semana</p>
            <p className="ba-value" style={{ fontSize: 34, marginTop: 10 }}>
              {currentWeekLongestRunKm.toFixed(1)} /{" "}
              {sisrunWeek ? sisrunWeek.longRunPlannedKm.toFixed(1) : "—"}
            </p>
            <p className="ba-muted" style={{ fontSize: 12 }}>
              km feito / previsto
            </p>
          </div>
        </section>

        <section
          className="ba-card"
          style={{
            padding: "1.35rem",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "1.2fr .8fr",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <div
            style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}
          >
            <span
              className={readiness.dot}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <div>
              <p
                style={{
                  color:
                    readiness.label === "Vermelho"
                      ? "#f87171"
                      : readiness.label === "Amarelo"
                        ? "#f5a623"
                        : "#34d399",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {readiness.title}
              </p>
              <p
                className="ba-muted"
                style={{ marginTop: 5, lineHeight: 1.55 }}
              >
                {readiness.description}
              </p>
            </div>
          </div>
          <div className="ba-card-soft" style={{ padding: "1rem" }}>
            <p className="ba-label">Leitura do ciclo</p>
            <p
              style={{
                marginTop: 8,
                color: "rgba(255,255,255,.82)",
                lineHeight: 1.55,
              }}
            >
              {cyclePhase.description}
            </p>
          </div>
        </section>

        <section className="ba-week" style={{ marginBottom: "1rem" }}>
          <div className="ba-card" style={{ padding: "1.35rem" }}>
            <p className="ba-label">Hoje</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                marginTop: 10,
              }}
            >
              Treino de hoje
            </h2>
            <div style={{ display: "grid", gap: ".7rem", marginTop: "1rem" }}>
              <div className="ba-card-soft" style={{ padding: ".85rem" }}>
                <p className="ba-label">Planejado</p>
                <p style={{ color: "#fff", fontWeight: 800, marginTop: 4 }}>
                  {todaySisrunRow
                    ? `${todaySisrunRow.plannedDistanceKm.toFixed(1)} km`
                    : "Sem treino"}
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: ".85rem" }}>
                <p className="ba-label">Strava</p>
                <p style={{ color: "#fff", fontWeight: 800, marginTop: 4 }}>
                  {todayStravaKm.toFixed(1)} km
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: ".85rem" }}>
                <p className="ba-label">Janela</p>
                <p style={{ color: "#fff", fontWeight: 800, marginTop: 4 }}>
                  {todaySisrunRow
                    ? `${todaySisrunRow.minPlannedTime ?? "—"} / ${todaySisrunRow.maxPlannedTime ?? "—"}`
                    : "—"}
                </p>
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                marginTop: "1rem",
                padding: ".35rem .65rem",
                borderRadius: 999,
                background: todayStatus.includes("Concl")
                  ? "rgba(16,185,129,.15)"
                  : "rgba(245,166,35,.12)",
                color: todayStatus.includes("Concl") ? "#34d399" : "#f5a623",
                border: `1px solid ${todayStatus.includes("Concl") ? "rgba(16,185,129,.25)" : "rgba(245,166,35,.25)"}`,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {todayStatus}
            </span>
          </div>

          <div className="ba-card" style={{ padding: "1.35rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <div>
                <p className="ba-label">Semana atual</p>
                <h2
                  style={{
                    color: "#fff",
                    fontSize: 24,
                    fontWeight: 800,
                    marginTop: 10,
                  }}
                >
                  Meta semanal
                </h2>
                <p className="ba-muted" style={{ marginTop: 4 }}>
                  SisRUN x execução real no Strava.
                </p>
              </div>
              <p className="ba-value" style={{ fontSize: 32 }}>
                {currentWeekKm.toFixed(1)} / {plannedWeekKm.toFixed(1)} km
              </p>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <div className="ba-progress">
                <div
                  className="ba-progress-fill"
                  style={{ width: `${weeklyAdherenceForUi}%` }}
                />
              </div>
              <p className="ba-muted" style={{ marginTop: 10, fontSize: 13 }}>
                Faltam {Math.max(plannedWeekKm - currentWeekKm, 0).toFixed(1)}{" "}
                km para cumprir o planejado da semana.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: ".8rem",
                marginTop: "1.25rem",
              }}
            >
              {alerts.slice(0, 2).map((alert) => (
                <div
                  key={alert.title}
                  className="ba-card-soft"
                  style={{
                    padding: "1rem",
                    borderColor:
                      alert.title.toLowerCase().includes("abaixo") ||
                      alert.title.toLowerCase().includes("não")
                        ? "rgba(239,68,68,.18)"
                        : "rgba(245,166,35,.16)",
                  }}
                >
                  <p
                    style={{
                      color:
                        alert.title.toLowerCase().includes("abaixo") ||
                        alert.title.toLowerCase().includes("não")
                          ? "#fca5a5"
                          : "#f5a623",
                      fontWeight: 800,
                    }}
                  >
                    {alert.title}
                  </p>
                  <p
                    className="ba-muted"
                    style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}
                  >
                    {alert.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {vdot && trainingPaces && (
          <section className="ba-two" style={{ marginBottom: "1rem" }}>
            <div className="ba-card" style={{ padding: "1.35rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <p className="ba-label">Performance</p>
                  <h2
                    style={{
                      color: "#fff",
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 10,
                    }}
                  >
                    VO2max estimado
                  </h2>
                  <p className="ba-muted" style={{ marginTop: 4 }}>
                    Calculado automaticamente pelos PRs do Strava.
                  </p>
                </div>
                <span
                  style={{
                    color: "#93c5fd",
                    background: "rgba(59,130,246,.12)",
                    border: "1px solid rgba(59,130,246,.25)",
                    padding: ".35rem .65rem",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  VDOT {vdot.toFixed(1)}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: ".8rem",
                  marginTop: "1.25rem",
                }}
              >
                <div
                  className="ba-card-soft"
                  style={{
                    padding: "1rem",
                    background: "rgba(59,130,246,.1)",
                    borderColor: "rgba(59,130,246,.2)",
                  }}
                >
                  <p className="ba-label">VO2max</p>
                  <p
                    className="ba-value"
                    style={{ fontSize: 42, color: "#60a5fa", marginTop: 8 }}
                  >
                    {vo2max?.toFixed(1) ?? vdot.toFixed(1)}
                  </p>
                  <p className="ba-muted" style={{ fontSize: 12 }}>
                    ml/kg/min
                  </p>
                </div>
                <div
                  className="ba-card-soft"
                  style={{
                    padding: "1rem",
                    background: "rgba(245,166,35,.1)",
                    borderColor: "rgba(245,166,35,.22)",
                  }}
                >
                  <p className="ba-label">Pace maratona</p>
                  <p
                    className="ba-value"
                    style={{ fontSize: 34, color: "#f5a623", marginTop: 8 }}
                  >
                    {marathonPaces
                      ? `${formatSecondsPerKm(marathonPaces.min).replace("/km", "")}–${formatSecondsPerKm(marathonPaces.max).replace("/km", "")}`
                      : "—"}
                  </p>
                  <p className="ba-muted" style={{ fontSize: 12 }}>
                    pelo VDOT
                  </p>
                </div>
              </div>
            </div>

            <div className="ba-card" style={{ padding: "1.35rem" }}>
              <p className="ba-label">Referência Daniels</p>
              <h2
                style={{
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: 800,
                  marginTop: 10,
                }}
              >
                Paces de treino
              </h2>
              <div
                style={{ display: "grid", gap: ".55rem", marginTop: "1rem" }}
              >
                {[
                  [
                    "Regenerativo / Fácil",
                    `${formatSecondsPerKm(trainingPaces.easy.min)}–${formatSecondsPerKm(trainingPaces.easy.max)}`,
                  ],
                  [
                    "Pace de maratona",
                    `${formatSecondsPerKm(trainingPaces.marathon.min)}–${formatSecondsPerKm(trainingPaces.marathon.max)}`,
                  ],
                  [
                    "Limiar",
                    `${formatSecondsPerKm(trainingPaces.threshold.min)}–${formatSecondsPerKm(trainingPaces.threshold.max)}`,
                  ],
                  ["Intervalado", formatSecondsPerKm(trainingPaces.interval)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: ".75rem .85rem",
                      borderRadius: 14,
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid rgba(255,255,255,.055)",
                    }}
                  >
                    <span className="ba-muted">{label}</span>
                    <strong style={{ color: "#fff" }}>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="ba-two" style={{ marginBottom: "1rem" }}>
          <div className="ba-card" style={{ padding: "1.35rem" }}>
            <p className="ba-label">Projeções</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                marginTop: 10,
              }}
            >
              Maratona
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: ".8rem",
                marginTop: "1.1rem",
              }}
            >
              <ProjectionCard
                title="Pace-alvo"
                value={formatFullDuration(targetPredictionSeconds)}
                caption={targetPaceLabel}
              />
              <ProjectionCard
                title="Melhor meia"
                value={
                  predictedFromHalf && bestHalf
                    ? formatFullDuration(predictedFromHalf)
                    : "Sem dado"
                }
                caption={
                  predictedFromHalf && bestHalf
                    ? `${bestHalf.name}`
                    : "Sem meia válida."
                }
              />
              <ProjectionCard
                title="Longão forte"
                value={
                  predictedFromLongRun && longestRun
                    ? formatFullDuration(predictedFromLongRun)
                    : "Sem dado"
                }
                caption={
                  predictedFromLongRun && longestRun
                    ? `${(longestRun.distance / 1000).toFixed(1)} km`
                    : "Falta longão robusto."
                }
              />
              <ProjectionCard
                title="Modelo do site"
                value={
                  predictedBySite
                    ? formatFullDuration(predictedBySite)
                    : "Sem dado"
                }
                caption="Meia + longão + volume"
                highlight
              />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <ManualPredictionForm
                initialValue={manualPredictions.stravaMarathonPrediction}
              />
            </div>
          </div>

          <div className="ba-card" style={{ padding: "1.35rem" }}>
            <p className="ba-label">Longões recentes</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
                marginTop: 10,
              }}
            >
              Especificidade
            </h2>
            <div
              style={{ display: "grid", gap: ".75rem", marginTop: "1.1rem" }}
            >
              {recentLongRuns.length > 0 ? (
                recentLongRuns.slice(0, 4).map((run) => {
                  const km = run.distance / 1000;
                  const hr = run.average_heartrate;
                  return (
                    <div
                      key={run.id}
                      style={{
                        padding: ".9rem",
                        borderRadius: 16,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: ".75rem",
                        }}
                      >
                        <div>
                          <p style={{ color: "#fff", fontWeight: 800 }}>
                            {run.name}
                          </p>
                          <p
                            className="ba-muted"
                            style={{ fontSize: 13, marginTop: 3 }}
                          >
                            {formatDate(run.start_date_local)}
                          </p>
                        </div>
                        <p style={{ color: "#f5a623", fontWeight: 900 }}>
                          {km.toFixed(1)} km
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: ".45rem",
                          flexWrap: "wrap",
                          marginTop: ".7rem",
                        }}
                      >
                        <span className="ba-pill ba-pill-dark">
                          {formatSecondsPerKm(run.moving_time / km)}
                        </span>
                        {hr && (
                          <span className="ba-pill ba-pill-dark">
                            {Math.round(hr)} bpm
                          </span>
                        )}
                        {run.total_elevation_gain > 0 && (
                          <span className="ba-pill ba-pill-dark">
                            +{Math.round(run.total_elevation_gain)} m
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="ba-muted">Nenhum longão identificado ainda.</p>
              )}
            </div>
          </div>
        </section>

        {projectionLongRuns.length >= 3 && (
          <section
            className="ba-card"
            style={{ overflow: "hidden", marginBottom: "1rem" }}
          >
            <MarathonProjection
              longRuns={projectionLongRuns}
              weeksToRace={weeksToRace}
              races={racePointsForProjection}
            />
          </section>
        )}

        {weeklyData.length > 0 && (
          <section style={{ marginBottom: "1rem" }}>
            <WeeklyPlanVsActualChart
              weeks={buildWeeklyComparison(sisrunData, activities, 16)
                .reverse()
                .map((w) => ({
                  label: w.label,
                  planned: w.plannedKm,
                  actual: w.executedKm,
                }))}
              title="Volume semanal — planejado vs. executado"
            />
          </section>
        )}

        <section className="ba-card" style={{ padding: "1.35rem" }}>
          <p className="ba-label">Resumo estratégico</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <div className="ba-card-soft" style={{ padding: "1rem" }}>
              <p style={{ color: "#fff", fontWeight: 800 }}>Momento</p>
              <p
                className="ba-muted"
                style={{ marginTop: 8, lineHeight: 1.55 }}
              >
                Ciclo em {cyclePhase.name}, com semáforo{" "}
                {readiness.label.toLowerCase()} e alvo de {targetPaceLabel}.
              </p>
            </div>
            <div className="ba-card-soft" style={{ padding: "1rem" }}>
              <p style={{ color: "#fff", fontWeight: 800 }}>Semana</p>
              <p
                className="ba-muted"
                style={{ marginTop: 8, lineHeight: 1.55 }}
              >
                {sisrunWeek
                  ? `${currentWeekKm.toFixed(1)} km executados de ${plannedWeekKm.toFixed(1)} km planejados.`
                  : "Sem SisRUN carregado para a semana."}
              </p>
            </div>
            <div className="ba-card-soft" style={{ padding: "1rem" }}>
              <p style={{ color: "#fff", fontWeight: 800 }}>Próximo foco</p>
              <p
                className="ba-muted"
                style={{ marginTop: 8, lineHeight: 1.55 }}
              >
                Aumentar consistência, longões e especificidade antes dos blocos
                mais fortes.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        STRAVA · RAFAEL CABRAL · BUENOS AIRES 2026
      </footer>
    </main>
  );
}

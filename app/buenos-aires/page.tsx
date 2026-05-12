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
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    if (!res.ok) { console.warn("Falha Strava activities:", res.status); return []; }
    return res.json();
  } catch (error) { console.warn("Erro ao buscar atividades:", error); return []; }
}

async function getActivityDetail(id: number, accessToken: string): Promise<StravaActivity | null> {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getAthlete(): Promise<Athlete | null> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return null;
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) { console.warn("Falha Strava athlete:", res.status); return null; }
    return res.json();
  } catch (error) { console.warn("Erro ao buscar atleta:", error); return null; }
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

function formatDate(dateString: string) { return formatBRDate(dateString); }

function formatFullDuration(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
}

function formatDurationShort(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatSecondsPerKm(secondsPerKm: number) {
  const m = Math.floor(secondsPerKm / 60), s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIST_MARATHON = 42.195;
const PROJECTION_LONG_RUN_MIN_KM = 18; // mínimo para entrar na calculadora

// ─── Business logic ───────────────────────────────────────────────────────────

function daysUntil(targetDate: Date) {
  return Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

function marathonTimeFromPace(secondsPerKm: number) {
  return Math.round(secondsPerKm * DIST_MARATHON);
}

function getCyclePhase(today: Date, raceDate: Date) {
  const days = daysUntil(raceDate);
  if (days > 140) return { name: "Base",       description: "Consolidar consistência, volume e resistência geral.",                       color: "bg-sky-500/10 text-sky-200 border border-sky-400/20"     };
  if (days > 70)  return { name: "Construção", description: "Aumentar volume e trazer mais especificidade para a maratona.",              color: "bg-amber-500/10 text-amber-300" };
  if (days > 21)  return { name: "Pico",       description: "Bloco mais específico, com longões fortes e sessões-chave.",                 color: "bg-orange-500/10 text-orange-200 border border-orange-400/20" };
  return               { name: "Taper",      description: "Redução de carga para chegar descansado e afiado.",                          color: "bg-emerald-500/10 text-emerald-300" };
}

function getIdealWeeklyVolume(daysToRace: number) {
  if (daysToRace > 140) return 50;
  if (daysToRace > 105) return 58;
  if (daysToRace > 70)  return 65;
  if (daysToRace > 42)  return 70;
  if (daysToRace > 21)  return 62;
  return 40;
}

function getReadinessStatus(params: { currentWeekKm: number; idealWeekKm: number; longestRunKm: number; longRuns28Plus: number }) {
  const ratio = params.idealWeekKm > 0 ? params.currentWeekKm / params.idealWeekKm : 0;
  if (ratio >= 0.9 && params.longestRunKm >= 28 && params.longRuns28Plus >= 2)
    return { label: "Verde",    title: "Prontidão forte",         description: "Seu ciclo mostra bons sinais de especificidade para sustentar a maratona.",              card: "bg-emerald-500/10 border-emerald-400/20", dot: "bg-emerald-500", text: "text-emerald-300" };
  if (ratio >= 0.7 && params.longestRunKm >= 24 && params.longRuns28Plus >= 1)
    return { label: "Amarelo",  title: "Prontidão em construção", description: "O caminho está bom, mas ainda faltam mais base e longões específicos.",                  card: "bg-amber-500/10 border-amber-400/20",    dot: "bg-amber-400",   text: "text-amber-300"   };
  return   { label: "Vermelho", title: "Prontidão baixa",         description: "Ainda falta especificidade de maratona para sustentar o alvo com segurança.",            card: "bg-red-500/10 border-red-400/20",        dot: "bg-red-400",     text: "text-red-300"     };
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

function predictBySiteModel(params: { bestHalf: StravaActivity | null; longestRun: StravaActivity | null; weeklyData: { label: string; distanceKm: number }[] }) {
  const halfP    = predictFromHalf(params.bestHalf);
  const longRunP = predictFromLongRun(params.longestRun);
  const avgWeekly = params.weeklyData.length ? params.weeklyData.reduce((s, x) => s + x.distanceKm, 0) / params.weeklyData.length : 0;
  if (halfP && longRunP) {
    let base = Math.round((halfP + longRunP) / 2);
    if (avgWeekly >= 60) base -= 120; else if (avgWeekly < 40) base += 180;
    return base;
  }
  if (halfP) { let base = halfP; if (avgWeekly >= 60) base -= 90; else if (avgWeekly < 40) base += 180; return base; }
  if (longRunP) return longRunP;
  return null;
}

function getHrZoneForBpm(bpm: number, zones: HrZone[]): HrZone | null {
  return zones.find((z) => bpm >= z.min && bpm <= z.max) ?? null;
}
function getHrPctMax(bpm: number, hrMax: number) { return Math.round((bpm / hrMax) * 100); }

function buildMarathonAlerts(params: { hasPlan: boolean; plannedWeekKm: number; currentWeekKm: number; adherencePct: number; plannedLongRunKm: number; currentWeekLongestRunKm: number; todayStatus: string; marathonPaceMin: number | null; vdot: number | null }) {
  const alerts: { title: string; text: string; tone: string }[] = [];
  if (!params.hasPlan) { alerts.push({ title: "Planejamento ausente", text: "Carregue uma planilha do SisRUN para comparar a semana atual.", tone: "bg-white/[0.03] text-zinc-100" }); return alerts; }
  if (params.adherencePct < 70)      alerts.push({ title: "Semana abaixo da meta",            text: `Você executou ${params.currentWeekKm.toFixed(1)} km de ${params.plannedWeekKm.toFixed(1)} km planejados.`,                                                    tone: "soft-danger"         });
  else if (params.adherencePct < 90) alerts.push({ title: "Semana em construção",             text: `Boa evolução, mas ainda faltam ${Math.max(params.plannedWeekKm - params.currentWeekKm, 0).toFixed(1)} km para a meta da semana.`,                           tone: "soft-alert"     });
  else                               alerts.push({ title: "Volume da semana bem encaminhado", text: "A execução está acompanhando bem o planejado do SisRUN.",                                                                                                     tone: "soft-success" });
  if (params.plannedLongRunKm > 0 && params.currentWeekLongestRunKm < params.plannedLongRunKm)
    alerts.push({ title: "Longão ainda não cumprido", text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`, tone: "soft-alert" });
  else if (params.plannedLongRunKm > 0)
    alerts.push({ title: "Longão da semana cumprido", text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`, tone: "soft-success" });
  if (params.todayStatus === "Pendente")
    alerts.push({ title: "Treino de hoje pendente", text: "A sessão de hoje ainda não aparece como cumprida no Strava.", tone: "soft-alert" });
  if (params.marathonPaceMin && params.vdot) {
    const gap = 320 - params.marathonPaceMin;
    if (gap > 20) alerts.push({ title: "Pace-alvo conservador vs. VO2max", text: `Seu VDOT ${params.vdot.toFixed(1)} indica potencial para ${formatSecondsPerKm(params.marathonPaceMin)} na maratona. Considere ajustar a meta conforme o ciclo avança.`, tone: "bg-[rgba(59,130,246,0.1)] text-[#93c5fd]" });
  }
  return alerts;
}

// ─── Helpers para a calculadora ───────────────────────────────────────────────

function calculateEfficiency(km: number, timeSec: number, hr: number | null | undefined, elev: number): number | null {
  if (!km || !timeSec || !hr) return null;
  const speed = km / (timeSec / 3600);
  const elevFactor = elev > 0 ? 1 + elev / (km * 100) : 1;
  return ((speed * elevFactor) / hr) * 1000;
}

function buildProjectionLongRuns(runs: StravaActivity[], enriched: StravaActivity[]) {
  const map = new Map(enriched.map((r) => [r.id, r]));
  return runs
    .filter((a) => a.distance / 1000 >= PROJECTION_LONG_RUN_MIN_KM)
    .sort((a, b) => new Date(getActivityDate(a)).getTime() - new Date(getActivityDate(b)).getTime())
    .map((run) => {
      const e   = map.get(run.id) ?? run;
      const km  = run.distance / 1000;
      const fc  = e.average_heartrate ? Math.round(e.average_heartrate) : null;
      return {
        date: getActivityDate(run),
        km: Number(km.toFixed(2)),
        paceSeconds: Math.round(run.moving_time / km),
        efficiency: calculateEfficiency(km, run.moving_time, e.average_heartrate, run.total_elevation_gain ?? 0),
        fc,
      };
    });
}

// ─── UI Components ────────────────────────────────────────────────────────────

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-zinc-100">{value}</h3>
    </div>
  );
}

function ProjectionCard({ title, value, caption, highlight = false, badge }: { title: string; value: string; caption: string; highlight?: boolean; badge?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "bg-[rgba(245,166,35,0.1)] ring-1 ring-orange-400/20" : "bg-white/[0.03]"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{title}</p>
        {badge && <span className="shrink-0 rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-xs font-medium text-[#93c5fd]">{badge}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold text-zinc-100">{value}</p>
      <p className="mt-1 text-sm text-zinc-100">{caption}</p>
    </div>
  );
}

function HrZoneBadge({ bpm, zones, hrMax }: { bpm: number; zones: HrZone[]; hrMax: number }) {
  const zone = getHrZoneForBpm(bpm, zones);
  const pct  = getHrPctMax(bpm, hrMax);
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: zone?.color ?? "#888" }}>{zone?.name ?? "—"}</span>
      <span className="text-xs text-zinc-100">{pct}% FCmáx</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BuenosAiresPage() {
  const accessToken = await getValidStravaAccessToken();

  const [athlete, activities, manualPredictions, sisrunData, athleteProfile] = await Promise.all([
    getAthlete(),
    getActivities(),
    getManualPredictions(),
    getSisrunData(),
    accessToken ? getDynamicAthleteProfile(accessToken) : Promise.resolve(null),
  ]);

  const sisrunWeek     = getCurrentWeek(sisrunData) as SisrunWeek | null;
  const todaySisrunRow = getTodaySisrunRow(sisrunData);

  const marathonGoal = {
    raceName: "Maratona de Buenos Aires",
    date: new Date("2026-09-20T06:00:00"),
    targetPaceSecondsPerKm: 320,
    targetWeeklyKm: 65,
    targetLongRunKm: 30,
  };

  const today      = new Date();
  const daysToRace = daysUntil(marathonGoal.date);
  const cyclePhase = getCyclePhase(today, marathonGoal.date);
  const runs       = activities.filter((a) => a.type === "Run");

  const longestRun   = runs.length ? runs.reduce((m, a) => (a.distance > m.distance ? a : m)) : null;
  const longestRunKm = longestRun ? longestRun.distance / 1000 : 0;

  const weekMap = new Map<string, { label: string; distanceKm: number }>();
  runs.forEach((a) => {
    const date = getBRDate(getActivityDate(a));
    if (!date) return;
    const ws  = getWeekStart(date);
    const key = ws.toISOString();
    const cur = weekMap.get(key);
    if (cur) cur.distanceKm += a.distance / 1000;
    else weekMap.set(key, { label: formatWeekLabel(ws), distanceKm: a.distance / 1000 });
  });

  const weeklyData = Array.from(weekMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-10)
    .map(([, v]) => ({ label: v.label, distanceKm: Number(v.distanceKm.toFixed(1)) }));

  const currentWeekKm           = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm           = getTodayStravaKm(activities);
  const plannedWeekKm           = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct      = plannedWeekKm > 0 ? (currentWeekKm / plannedWeekKm) * 100 : 0;
  const weeklyGoalKm            = marathonGoal.targetWeeklyKm;
  const weeklyProgress          = Math.min((currentWeekKm / weeklyGoalKm) * 100, 100);
  const targetPaceLabel         = formatSecondsPerKm(marathonGoal.targetPaceSecondsPerKm);
  const targetPredictionSeconds = marathonTimeFromPace(marathonGoal.targetPaceSecondsPerKm);
  const longRuns28Plus          = runs.filter((a) => a.distance >= 28000);
  const idealWeekKm             = getIdealWeeklyVolume(daysToRace);
  const weekVsIdealDifference   = currentWeekKm - idealWeekKm;

  const readiness = getReadinessStatus({ currentWeekKm, idealWeekKm, longestRunKm, longRuns28Plus: longRuns28Plus.length });

  const bestHalf = runs.filter((a) => { const km = a.distance / 1000; return km >= 20 && km <= 22; }).sort((a, b) => a.moving_time - b.moving_time)[0] ?? null;

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

  const predictedFromHalf      = predictFromHalf(bestHalf);
  const predictedFromLongRun   = predictFromLongRun(longestRun);
  const predictedBySite        = predictBySiteModel({ bestHalf, longestRun, weeklyData });

  // Projeção dinâmica pelo VDOT calculado dos PRs do Strava
  const vdot    = athleteProfile?.vdot ?? null;
  const vo2max  = athleteProfile?.vo2max ?? null;
  const marathonPaces = athleteProfile?.paces.marathon ?? null;
  const predictedFromVdotRange = marathonPaces
    ? { min: marathonTimeFromPace(marathonPaces.min), max: marathonTimeFromPace(marathonPaces.max) }
    : null;

  // Paces de treino corrigidos pela fórmula de Daniels (% do VDOT)
  const trainingPaces = vdot ? trainingPacesFromVdot(vdot) : null;

  const recentLongRunsBase = runs
    .filter((a) => a.distance >= 18000)
    .sort((a, b) => new Date(getActivityDate(b)).getTime() - new Date(getActivityDate(a)).getTime())
    .slice(0, 5);

  const recentLongRuns = await Promise.all(
    recentLongRunsBase.map(async (run) => {
      if (run.average_heartrate) return run;
      if (accessToken) { const d = await getActivityDetail(run.id, accessToken); if (d?.average_heartrate) return { ...run, ...d }; }
      return run;
    })
  );

  // ── Dados para a calculadora de projeção ──────────────────────────────────
  const projRunsBase = runs
    .filter((a) => a.distance / 1000 >= PROJECTION_LONG_RUN_MIN_KM)
    .sort((a, b) => new Date(getActivityDate(a)).getTime() - new Date(getActivityDate(b)).getTime());

  const projRunsEnriched = await Promise.all(
    projRunsBase.map(async (run) => {
      if (run.average_heartrate) return run;
      if (accessToken) { const d = await getActivityDetail(run.id, accessToken); if (d?.average_heartrate) return { ...run, ...d }; }
      return run;
    })
  );

  const projectionLongRuns = buildProjectionLongRuns(projRunsBase, projRunsEnriched);
  const weeksToRace = Math.max(1, Math.ceil(daysToRace / 7));
  // ──────────────────────────────────────────────────────────────────────────

  const todayStatus = !todaySisrunRow ? "Sem treino previsto hoje"
    : todayStravaKm <= 0 ? "Pendente"
    : todaySisrunRow.plannedDistanceKm > 0 && todayStravaKm >= todaySisrunRow.plannedDistanceKm ? "Concluído"
    : "Parcial";

  const alerts  = buildMarathonAlerts({ hasPlan: Boolean(sisrunWeek), plannedWeekKm, currentWeekKm, adherencePct: weeklyAdherencePct, plannedLongRunKm: sisrunWeek?.longRunPlannedKm ?? 0, currentWeekLongestRunKm, todayStatus, marathonPaceMin: marathonPaces?.min ?? null, vdot });
  const hrZones: HrZone[] = [];
  const hrMax   = 184;

  return (
    <div className="page">
      <Navbar />
      <main className="page-shell">
        <div className="space-y-8">
          {/* Hero limpo, seguindo a linguagem da home */}
          <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b0c] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:px-8 md:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(245,166,35,0.22),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(249,115,22,0.13),transparent_28%)]" />
            <div className="relative grid gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-orange-400">
                  Road to Buenos Aires · 20/09
                </p>
                <h1 className="mt-5 max-w-[520px] text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white md:text-7xl">
                  Maratona de Buenos Aires
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
                  Painel do ciclo com volume, longão, aderência semanal, VDOT e projeções para a prova-alvo.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/" className="inline-flex items-center justify-center rounded-2xl bg-orange-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-orange-300">
                    ← Dashboard
                  </Link>
                  <Link href="/longoes" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-orange-400/40">
                    Ver longões
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-orange-400/25 bg-orange-400/[0.08] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-300">
                      Contagem regressiva
                    </p>
                    <span className="rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-200">
                      Prova-alvo
                    </span>
                  </div>
                  <RaceCountdown targetDate="2026-09-20T06:00:00-03:00" raceName="Buenos Aires" />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="metric-card">
                    <p className="card__label">Pace-alvo</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-white">{targetPaceLabel}</p>
                  </div>
                  <div className="metric-card">
                    <p className="card__label">Tempo projetado</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-white">{formatFullDuration(targetPredictionSeconds)}</p>
                  </div>
                  <div className="metric-card">
                    <p className="card__label">Fase</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-white">{cyclePhase.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Status compacto */}
          <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="card border-orange-400/20 bg-orange-400/[0.06]">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-3 w-3 rounded-full ${readiness.dot}`} />
                <div>
                  <p className={`text-lg font-black ${readiness.text}`}>{readiness.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">Semáforo atual: {readiness.label}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">{readiness.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard title="Semana planejada" value={sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "-"} />
              <InfoCard title="Semana feita" value={`${currentWeekKm.toFixed(1)} km`} />
              <InfoCard title="Aderência" value={sisrunWeek ? `${Math.min(weeklyAdherencePct, 100).toFixed(0)}%` : "-"} />
              <InfoCard title="Longão" value={sisrunWeek ? `${currentWeekLongestRunKm.toFixed(1)} / ${sisrunWeek.longRunPlannedKm.toFixed(1)} km` : `${currentWeekLongestRunKm.toFixed(1)} km`} />
            </div>
          </section>

          {/* Semana */}
          <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="card">
              <p className="card__label">Hoje</p>
              <h2 className="mt-2 text-2xl font-black text-white">Treino de hoje</h2>
              {todaySisrunRow ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="metric-pill"><p className="metric-pill__label">Planejado</p><p className="metric-pill__value">{todaySisrunRow.plannedDistanceKm.toFixed(1)} km</p></div>
                  <div className="metric-pill"><p className="metric-pill__label">Strava</p><p className="metric-pill__value">{todayStravaKm.toFixed(1)} km</p></div>
                  <div className="metric-pill"><p className="metric-pill__label">Janela</p><p className="metric-pill__value">{todaySisrunRow.minPlannedTime ?? "-"} / {todaySisrunRow.maxPlannedTime ?? "-"}</p></div>
                  <span className="mt-1 inline-flex w-fit rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{todayStatus}</span>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">Nenhum treino previsto para hoje.</p>
              )}
            </div>

            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="card__label">Semana atual</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Meta semanal</h2>
                </div>
                <p className="text-right text-2xl font-black text-white">
                  {currentWeekKm.toFixed(1)} / {sisrunWeek ? plannedWeekKm.toFixed(1) : weeklyGoalKm.toFixed(1)} km
                </p>
              </div>
              <div className="mt-5 progress-bar h-3">
                <div className="progress-bar__fill" style={{ width: `${sisrunWeek ? Math.min(weeklyAdherencePct, 100) : weeklyProgress}%` }} />
              </div>
              {sisrunWeek ? (
                <p className="mt-4 text-sm leading-6 text-zinc-400">
                  Faltam <span className="font-semibold text-zinc-200">{Math.max(plannedWeekKm - currentWeekKm, 0).toFixed(1)} km</span> para cumprir o planejado da semana.
                </p>
              ) : (
                <p className="mt-4 text-sm leading-6 text-zinc-400">Sem semana do SisRUN carregada. Usando apenas a meta configurada.</p>
              )}
            </div>
          </section>

          {/* Alertas */}
          <section className="grid gap-4 lg:grid-cols-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`rounded-3xl p-5 ${alert.tone}`}>
                <p className="font-bold">{alert.title}</p>
                <p className="mt-2 text-sm leading-6">{alert.text}</p>
              </div>
            ))}
          </section>

          {/* VO2max e paces */}
          {athleteProfile && vdot && (
            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="card__label">Performance</p>
                    <h2 className="mt-2 text-2xl font-black text-white">VO2max estimado</h2>
                    <p className="mt-2 text-sm text-zinc-400">Calculado automaticamente a partir dos PRs do Strava.</p>
                  </div>
                  <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-300">VDOT {vdot.toFixed(1)}</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                    <p className="card__label text-blue-300">VO2max</p>
                    <p className="mt-2 text-4xl font-black text-blue-300">{vo2max?.toFixed(1)}</p>
                    <p className="mt-1 text-xs text-blue-200/70">ml/kg/min</p>
                  </div>
                  <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
                    <p className="card__label text-orange-300">Pace maratona</p>
                    <p className="mt-2 text-2xl font-black text-orange-300">{marathonPaces ? `${formatSecondsPerKm(marathonPaces.min)}–${formatSecondsPerKm(marathonPaces.max)}` : "—"}</p>
                    <p className="mt-1 text-xs text-orange-200/70">pelo VDOT</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-bold text-zinc-200">PRs usados no cálculo</p>
                  <div className="mt-3 space-y-2">
                    {(["km5", "km10", "half", "marathon"] as const).map((key) => {
                      const pr = athleteProfile.prs[key];
                      const labels = { km5: "5 km", km10: "10 km", half: "Meia maratona", marathon: "Maratona" };
                      const isPartial = pr && pr.ageMonths > 6;
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-400">{labels[key]}</span>
                          {pr ? (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-100">{formatPrTime(pr.timeSec)}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isPartial ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>{pr.ageMonths}m</span>
                            </div>
                          ) : <span className="text-xs text-zinc-500">Não encontrado</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="card__label">Referências</p>
                <h2 className="mt-2 text-2xl font-black text-white">Paces de treino pelo VDOT</h2>
                <p className="mt-2 text-sm text-zinc-400">Referências de Daniels derivadas do VDOT {vdot.toFixed(1)}.</p>
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Regenerativo / Fácil", pace: trainingPaces ? `${formatSecondsPerKm(trainingPaces.easy.min)}–${formatSecondsPerKm(trainingPaces.easy.max)}` : "—", desc: "Z1–Z2", cls: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" },
                    { label: "Pace de maratona", pace: trainingPaces ? `${formatSecondsPerKm(trainingPaces.marathon.min)}–${formatSecondsPerKm(trainingPaces.marathon.max)}` : "—", desc: "Z3", cls: "border-orange-400/20 bg-orange-400/10 text-orange-200" },
                    { label: "Limiar", pace: trainingPaces ? `${formatSecondsPerKm(trainingPaces.threshold.min)}–${formatSecondsPerKm(trainingPaces.threshold.max)}` : "—", desc: "Z4", cls: "border-amber-400/20 bg-amber-400/10 text-amber-200" },
                    { label: "Intervalado", pace: trainingPaces ? formatSecondsPerKm(trainingPaces.interval) : "—", desc: "Z5", cls: "border-red-400/20 bg-red-400/10 text-red-200" },
                  ].map((row) => (
                    <div key={row.label} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${row.cls}`}>
                      <div>
                        <p className="font-bold text-zinc-100">{row.label}</p>
                        <p className="text-xs text-zinc-400">{row.desc}</p>
                      </div>
                      <p className="text-right text-lg font-black text-white">{row.pace}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Projeções + Longões recentes */}
          <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <div className="card">
              <p className="card__label">Cenários</p>
              <h2 className="mt-2 text-2xl font-black text-white">Projeções da maratona</h2>
              <p className="mt-2 text-sm text-zinc-400">Comparação entre alvo, leituras automáticas, VDOT e previsão manual.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ProjectionCard title="Pelo pace-alvo" value={formatFullDuration(targetPredictionSeconds)} caption={targetPaceLabel} />
                <ProjectionCard title="Pela melhor meia" value={predictedFromHalf && bestHalf ? formatFullDuration(predictedFromHalf) : "Sem dado"} caption={predictedFromHalf && bestHalf ? `${bestHalf.name} • ${formatDate(bestHalf.start_date_local)}` : "Nenhuma meia encontrada."} />
                <ProjectionCard title="Pelo longão mais forte" value={predictedFromLongRun && longestRun ? formatFullDuration(predictedFromLongRun) : "Sem dado"} caption={predictedFromLongRun && longestRun ? `${longestRun.name} • ${(longestRun.distance / 1000).toFixed(1)} km` : "Falta um longão mais robusto."} />
                <ProjectionCard title="Modelo do site" value={predictedBySite ? formatFullDuration(predictedBySite) : "Sem dado"} caption={predictedBySite ? "Meia + longão + consistência semanal." : "Dados insuficientes."} highlight />
              </div>
              {predictedFromVdotRange && vdot && marathonPaces && (
                <div className="mt-4 rounded-2xl border border-blue-400/25 bg-blue-400/10 p-4">
                  <p className="text-sm font-bold text-blue-300">Por VDOT {vdot.toFixed(1)} — PRs do Strava</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatDurationShort(predictedFromVdotRange.min)}–{formatDurationShort(predictedFromVdotRange.max)}</p>
                  <p className="mt-1 text-sm text-blue-200/75">Pace {formatSecondsPerKm(marathonPaces.min)}–{formatSecondsPerKm(marathonPaces.max)} · VO2max {vo2max?.toFixed(1)}</p>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <ManualPredictionForm initialValue={manualPredictions.stravaMarathonPrediction} />
              </div>
            </div>

            <div className="card">
              <p className="card__label">Especificidade</p>
              <h2 className="mt-2 text-2xl font-black text-white">Longões recentes</h2>
              <div className="mt-5 space-y-3">
                {recentLongRuns.length > 0 ? recentLongRuns.map((run) => {
                  const km = run.distance / 1000;
                  const hr = run.average_heartrate;
                  return (
                    <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">{run.name}</p>
                          <p className="mt-1 text-sm text-zinc-400">{formatDate(run.start_date_local)} · {km.toFixed(1)} km · {formatSecondsPerKm(run.moving_time / km)}</p>
                        </div>
                        {hr ? <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-zinc-200">{Math.round(hr)} bpm</span> : null}
                      </div>
                      <div className="mt-3">
                        <ActivitySplitsChart activityId={run.id} activityName={run.name} targetPaceSecPerKm={run.moving_time / km} goalPaceSecPerKm={320} />
                      </div>
                    </div>
                  );
                }) : <p className="text-zinc-500">Nenhum longão identificado ainda.</p>}
              </div>
            </div>
          </section>

          {projectionLongRuns.length >= 3 && (
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035]">
              <MarathonProjection longRuns={projectionLongRuns} weeksToRace={weeksToRace} races={racePointsForProjection} />
            </section>
          )}

          {weeklyData.length > 0 && (
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
              <WeeklyPlanVsActualChart
                weeks={buildWeeklyComparison(sisrunData, activities, 16).reverse().map((w) => ({
                  label: w.label,
                  planned: w.plannedKm,
                  actual: w.executedKm,
                }))}
                title="Volume semanal — planejado vs. executado"
              />
            </section>
          )}

          <section className="card">
            <p className="card__label">Leitura final</p>
            <h2 className="mt-2 text-2xl font-black text-white">Resumo estratégico</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-zinc-200">Momento do ciclo</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">O alvo está em <span className="font-semibold text-zinc-200">{targetPaceLabel}</span>, projetando <span className="font-semibold text-zinc-200">{formatFullDuration(targetPredictionSeconds)}</span>. A fase atual é <span className="font-semibold text-zinc-200">{cyclePhase.name}</span>.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-zinc-200">Planejado x executado</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{sisrunWeek ? <>O SisRUN prevê <span className="font-semibold text-zinc-200">{plannedWeekKm.toFixed(1)} km</span> nesta semana; o Strava mostra <span className="font-semibold text-zinc-200">{currentWeekKm.toFixed(1)} km</span>.</> : <>Sem semana do SisRUN carregada.</>}</p>
              </div>
              {vdot && marathonPaces && (
                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <p className="text-sm font-bold text-blue-300">Potencial pelo VO2max</p>
                  <p className="mt-2 text-sm leading-6 text-blue-100/75">VDOT {vdot.toFixed(1)} indica potencial para <span className="font-semibold text-blue-100">{formatSecondsPerKm(marathonPaces.min)}–{formatSecondsPerKm(marathonPaces.max)}</span> na maratona.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}
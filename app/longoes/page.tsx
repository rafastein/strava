export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { formatBRDate, getBRDateKey } from "../lib/date-utils";
import { getSisrunData } from "../lib/sisrun-utils";
import {
  formatEfficiency,
  formatLongRunDuration,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
} from "../lib/strava-long-runs";
import LongRunCharts from "../components/LongRunCharts";
import ActivitySplitsChart from "../components/ActivitySplitsChart";

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  type: string;
  start_date: string;
  start_date_local: string;
  start_latlng?: [number, number] | [] | null;
  location_city?: string | null;
  location_state?: string | null;
};

const STRAVA_AFTER_EPOCH = Math.floor(
  new Date("2024-01-01T00:00:00Z").getTime() / 1000,
);
const BUENOS_AIRES_GOAL_PACE_SEC_PER_KM = 320;
const BUENOS_AIRES_RACE_DATE = new Date("2026-09-20T12:00:00");
const MARATHON_CYCLE_START_DATE = new Date("2026-05-18T12:00:00");
const MARATHON_CYCLE_END_DATE = new Date("2026-09-20T12:00:00");
const MAX_REASONABLE_LONG_RUN_KM = 45;

type MarathonCycleRace = {
  dateKey: string;
  name: string;
  location: string;
  distanceKm: number;
  isGoal?: boolean;
};

const MARATHON_CYCLE_RACES: MarathonCycleRace[] = [
  { dateKey: "2026-05-24", name: "Meia de Lima", location: "Lima", distanceKm: 21.1 },
  { dateKey: "2026-06-06", name: "Meia do Rio", location: "Rio de Janeiro", distanceKm: 21.1 },
  { dateKey: "2026-06-20", name: "Praia Grande 10K", location: "Praia Grande", distanceKm: 10 },
  { dateKey: "2026-06-21", name: "Praia Grande 5K", location: "Praia Grande", distanceKm: 5 },
  { dateKey: "2026-06-28", name: "Meia de BH", location: "Belo Horizonte", distanceKm: 21.1 },
  { dateKey: "2026-07-26", name: "Asics Run Challenge", location: "Brasil", distanceKm: 15 },
  { dateKey: "2026-08-01", name: "Meia da Chapada", location: "Chapada", distanceKm: 21.1 },
  { dateKey: "2026-08-09", name: "Meia da PF", location: "Brasília", distanceKm: 21.1 },
  { dateKey: "2026-08-16", name: "Track & Field 15K", location: "Brasília", distanceKm: 15 },
  { dateKey: "2026-08-30", name: "Run The Bridge", location: "Brasil", distanceKm: 30 },
  { dateKey: "2026-09-20", name: "Buenos Aires", location: "Argentina", distanceKm: 42, isGoal: true },
];

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];

    const allActivities: StravaActivity[] = [];
    const perPage = 200;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      url.searchParams.set("after", String(STRAVA_AFTER_EPOCH));

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (!res.ok) break;

      const pageActivities = (await res.json()) as StravaActivity[];
      if (!Array.isArray(pageActivities) || pageActivities.length === 0) break;

      allActivities.push(...pageActivities);
      if (pageActivities.length < perPage) break;
    }

    return allActivities;
  } catch {
    return [];
  }
}

function getEfficiencyBadge(efficiency: number | null): {
  label: string;
  badge: string;
} {
  if (!efficiency) return { label: "Sem dados", badge: "badge badge--muted" };
  if (efficiency >= 16) return { label: "Alta eficiência", badge: "badge badge--success" };
  if (efficiency >= 14) return { label: "Boa eficiência", badge: "badge badge--blue" };
  return { label: "Eficiência moderada", badge: "badge badge--orange" };
}

function getEfficiencyTrend(
  current?: number | null,
  previous?: number | null,
): { emoji: string; label: string; detail: string; tone: string } {
  if (!current || !previous)
    return {
      emoji: "➖",
      label: "Sem base anterior",
      detail: "Ainda não há longão anterior com eficiência para comparar.",
      tone: "text-white/45",
    };

  const diff = current - previous;
  if (Math.abs(diff) < 1)
    return {
      emoji: "➖",
      label: "Estável",
      detail: `Variação de ${diff >= 0 ? "+" : ""}${diff.toFixed(0)} ponto.`,
      tone: "text-white/55",
    };

  if (diff > 0)
    return {
      emoji: "📈",
      label: "Melhorou",
      detail: `+${diff.toFixed(0)} pontos em relação ao longão anterior.`,
      tone: "text-emerald-400",
    };

  return {
    emoji: "📉",
    label: "Piorou",
    detail: `${diff.toFixed(0)} pontos em relação ao longão anterior.`,
    tone: "text-red-400",
  };
}

function InfoCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "accent" | "blue" | "success" | "danger";
}) {
  const valueClass = {
    accent: "ba-value--accent",
    blue: "ba-value--blue",
    success: "ba-value--success",
    danger: "ba-value--danger",
  }[accent ?? "accent"];

  return (
    <div className="ba-card longoes-info-card" style={{ padding: "1.2rem 1.4rem", textAlign: "center" }}>
      <p className="ba-label">{title}</p>
      <h2 className={`ba-value ${accent ? valueClass : ""}`} style={{ marginTop: ".4rem", fontSize: "clamp(1.4rem, 2.5vw, 2rem)" }}>{value}</h2>
      {sub && <p className="ba-muted" style={{ marginTop: ".3rem" }}>{sub}</p>}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ba-card-soft longoes-metric-pill" style={{ padding: ".65rem 1rem" }}>
      <p className="ba-label">{label}</p>
      <p style={{ marginTop: ".25rem", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function PaceBar({
  paceSecPerKm,
  best,
  worst,
}: {
  paceSecPerKm: number | null;
  best: number;
  worst: number;
}) {
  if (!paceSecPerKm || worst === best) return null;
  const pct = Math.min(
    100,
    Math.max(0, ((worst - paceSecPerKm) / (worst - best)) * 100),
  );

  return (
    <div className="ba-progress mt-3">
      <div className="ba-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}


type SisrunWorkoutItem = {
  weekday?: string;
  dateLabel?: string;
  workoutType?: string;
  plannedDistanceKm?: number | null;
  description?: string;
  isRace?: boolean;
};

type SisrunWeekWithWorkouts = {
  weekLabel?: string;
  weekStart?: string;
  weekEnd?: string;
  longRunPlannedKm?: number | null;
  totalPlannedKm?: number | null;
  workouts?: SisrunWorkoutItem[];
};

type SisrunDataWithWorkouts = {
  weeks?: SisrunWeekWithWorkouts[];
};

type PlanStatus = "done" | "partial" | "missed" | "future" | "today" | "review";

type MarathonLongRunPlanItem = {
  key: string;
  date: Date;
  dateLabel: string;
  shortDateLabel: string;
  weekday: string;
  weekLabel: string;
  plannedKm: number;
  actualKm: number | null;
  diffKm: number | null;
  status: PlanStatus;
  title: string;
  typeLabel: string;
  note: string;
  matchedActivity: StravaActivity | null;
  isKeyWorkout: boolean;
  isRaceGoal: boolean;
  isRace: boolean;
  raceName?: string;
  raceLocation?: string;
  needsReview: boolean;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseBrDateLabel(dateLabel?: string | null) {
  if (!dateLabel) return null;
  const match = dateLabel.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);

  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function getTodayInBrazil() {
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function getDateKeyFromDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function daysBetween(a: Date, b: Date) {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / dayMs);
}

function formatPlanDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatShortPlanDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatKm(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")} km`;
}

function findRaceForPlanDate(date: Date, plannedKm: number) {
  const plannedDateKey = getDateKeyFromDate(date);
  const exactRace = MARATHON_CYCLE_RACES.find((race) => race.dateKey === plannedDateKey);
  if (exactRace) return exactRace;

  if (!Number.isFinite(plannedKm) || plannedKm <= 0) return null;

  return MARATHON_CYCLE_RACES.find((race) => {
    const raceDate = parseDateKey(race.dateKey);
    if (!raceDate) return false;

    const sameWeekend = Math.abs(daysBetween(date, raceDate)) <= 1;
    const compatibleDistance = plannedKm >= race.distanceKm * 0.7 && plannedKm <= race.distanceKm * 1.35;

    return sameWeekend && compatibleDistance;
  }) ?? null;
}

function getPlanStatusMeta(status: PlanStatus) {
  if (status === "done") return { label: "Cumprido", badge: "badge badge--success" };
  if (status === "partial") return { label: "Parcial", badge: "badge badge--orange" };
  if (status === "missed") return { label: "Pendente", badge: "badge badge--danger" };
  if (status === "today") return { label: "Hoje", badge: "badge badge--accent" };
  if (status === "review") return { label: "Revisar SisRUN", badge: "badge badge--purple" };
  return { label: "Futuro", badge: "badge badge--blue" };
}

function getLongRunTypeLabel(plannedKm: number, isRaceGoal: boolean, isRace: boolean) {
  if (isRaceGoal) return "Prova-alvo";
  if (isRace) return "Longão em prova";
  if (plannedKm >= 30) return "Longão-chave";
  if (plannedKm >= 25) return "Longão específico";
  if (plannedKm >= 21) return "Longão controlado";
  return "Controle de ciclo";
}

function getLongRunTitle(item: {
  plannedKm: number;
  isRaceGoal: boolean;
  isRace: boolean;
  raceName?: string;
  needsReview: boolean;
  date: Date;
  workoutType?: string;
}) {
  if (item.needsReview) return "Revisar distância planejada";
  if (item.isRaceGoal) return "Maratona de Buenos Aires";
  if (item.isRace) return item.raceName ?? "Longão em prova";
  if (item.plannedKm >= 30) return "Simulação de maratona";
  if (item.plannedKm >= 25) return "Construção específica";
  if (item.plannedKm >= 21) return "Longão controlado";

  const normalizedType = normalizeText(item.workoutType ?? "");
  if (normalizedType.includes("longo")) return "Longão controlado";
  return "Maior treino da semana";
}

function getLongRunNote(item: MarathonLongRunPlanItem) {
  if (item.needsReview) {
    return "Distância acima do padrão esperado para o ciclo. Vale conferir se não entrou como placeholder.";
  }

  if (item.isRaceGoal) {
    return "Chegada do ciclo: executar estratégia, hidratação e controle emocional.";
  }

  if (item.isRace) {
    const raceLabel = item.raceName ? `${item.raceName}${item.raceLocation ? ` · ${item.raceLocation}` : ""}` : "prova do calendário";
    return `Longão em prova: usar ${raceLabel} como estímulo do ciclo, sem perder o controle da estratégia.`;
  }

  if (item.plannedKm >= 30) {
    return "Treino-chave para testar gel, hidratação, tênis e ritmo de maratona.";
  }

  if (item.plannedKm >= 25) {
    return "Bloco importante para sustentar volume e resistência sem transformar em prova.";
  }

  if (item.plannedKm >= 21) {
    return "Bom marcador de base aeróbica e recuperação dentro do ciclo.";
  }

  return "Semana de controle: manter consistência e sair inteiro para o próximo bloco.";
}

function findMatchingRun(
  plannedDate: Date,
  plannedKm: number,
  activities: StravaActivity[],
) {
  if (!Number.isFinite(plannedKm) || plannedKm <= 0 || plannedKm > MAX_REASONABLE_LONG_RUN_KM) {
    return null;
  }

  const minDistanceToMatch = Math.max(6, plannedKm * 0.5);

  const candidates = activities
    .filter((activity) => activity.type === "Run")
    .map((activity) => {
      const dateKey = getBRDateKey(activity.start_date_local ?? activity.start_date);
      const date = parseDateKey(dateKey);
      const distanceKm = activity.distance / 1000;

      return {
        activity,
        date,
        distanceKm,
        diffDays: date ? Math.abs(daysBetween(date, plannedDate)) : 999,
      };
    })
    .filter((item) => item.date && item.diffDays <= 1)
    .filter((item) => item.distanceKm >= minDistanceToMatch)
    .sort((a, b) => {
      if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
      return b.distanceKm - a.distanceKm;
    });

  return candidates[0]?.activity ?? null;
}

function getPlanStatus({
  date,
  plannedKm,
  actualKm,
  needsReview,
}: {
  date: Date;
  plannedKm: number;
  actualKm: number | null;
  needsReview: boolean;
}): PlanStatus {
  if (needsReview) return "review";

  const today = getTodayInBrazil();
  const diffDays = daysBetween(date, today);

  if (diffDays > 0) return "future";

  if (diffDays === 0 && !actualKm) return "today";

  if (!actualKm) return "missed";
  if (actualKm >= plannedKm * 0.95) return "done";
  if (actualKm >= plannedKm * 0.7) return "partial";
  return "missed";
}

function buildMarathonLongRunPlan(
  sisrunData: SisrunDataWithWorkouts | null,
  activities: StravaActivity[],
): MarathonLongRunPlanItem[] {
  if (!sisrunData?.weeks?.length) return [];

  const seenDates = new Set<string>();

  const items = sisrunData.weeks.flatMap((week) => {
    const longRunKm = Number(week.longRunPlannedKm ?? 0);
    if (!Number.isFinite(longRunKm) || longRunKm <= 0) return [];

    const workouts = week.workouts ?? [];
    const plannedWorkouts = workouts.filter((workout) => {
      const plannedKm = Number(workout.plannedDistanceKm ?? 0);
      if (!Number.isFinite(plannedKm) || plannedKm <= 0) return false;

      const type = normalizeText(workout.workoutType ?? "");
      const isLongType = type.includes("longo");
      const isWeekLongRun = Math.abs(plannedKm - longRunKm) < 0.05;

      return isLongType || isWeekLongRun;
    });

    const sourceWorkouts = plannedWorkouts.length
      ? plannedWorkouts
      : workouts.filter((workout) => Number(workout.plannedDistanceKm ?? 0) === longRunKm);

    return sourceWorkouts.map((workout) => {
      const date = parseBrDateLabel(workout.dateLabel);
      const plannedKm = Number(workout.plannedDistanceKm ?? longRunKm);

      if (!date || !Number.isFinite(plannedKm) || plannedKm <= 0) return null;
      if (date < MARATHON_CYCLE_START_DATE || date > MARATHON_CYCLE_END_DATE) return null;

      const dateKey = getDateKeyFromDate(date);
      if (seenDates.has(dateKey)) return null;
      seenDates.add(dateKey);

      const race = findRaceForPlanDate(date, plannedKm);
      const isRaceGoal = Boolean(race?.isGoal) || (Math.abs(daysBetween(date, BUENOS_AIRES_RACE_DATE)) <= 1 && plannedKm >= 40);
      const isRace = Boolean(workout.isRace || race) && !isRaceGoal;
      const needsReview = plannedKm > MAX_REASONABLE_LONG_RUN_KM && !isRaceGoal;
      const matchedActivity = findMatchingRun(date, plannedKm, activities);
      const actualKm = matchedActivity ? matchedActivity.distance / 1000 : null;
      const diffKm = actualKm !== null ? actualKm - plannedKm : null;
      const status = getPlanStatus({ date, plannedKm, actualKm, needsReview });
      const typeLabel = getLongRunTypeLabel(plannedKm, isRaceGoal, isRace);

      const planItem: MarathonLongRunPlanItem = {
        key: dateKey,
        date,
        dateLabel: formatPlanDate(date),
        shortDateLabel: formatShortPlanDate(date),
        weekday: workout.weekday ?? "",
        weekLabel: week.weekLabel ?? "",
        plannedKm,
        actualKm,
        diffKm,
        status,
        title: getLongRunTitle({
          plannedKm,
          isRaceGoal,
          isRace,
          raceName: race?.name,
          needsReview,
          date,
          workoutType: workout.workoutType,
        }),
        typeLabel,
        note: "",
        matchedActivity,
        isKeyWorkout: plannedKm >= 30 || isRaceGoal || isRace,
        isRaceGoal,
        isRace,
        raceName: race?.name,
        raceLocation: race?.location,
        needsReview,
      };

      return {
        ...planItem,
        note: getLongRunNote(planItem),
      };
    }).filter((item): item is MarathonLongRunPlanItem => Boolean(item));
  });

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getCyclePlanStats(items: MarathonLongRunPlanItem[]) {
  const validItems = items.filter((item) => !item.needsReview);
  const dueItems = validItems.filter((item) => item.date <= getTodayInBrazil());
  const completedItems = validItems.filter((item) => item.status === "done");
  const partialItems = validItems.filter((item) => item.status === "partial");
  const nextLongRun = validItems.find((item) => item.status === "future" || item.status === "today") ?? null;
  const biggestLongRun = validItems.length
    ? validItems.reduce((best, item) => (item.plannedKm > best.plannedKm ? item : best))
    : null;

  const plannedKm = validItems.reduce((sum, item) => sum + item.plannedKm, 0);
  const duePlannedKm = dueItems.reduce((sum, item) => sum + item.plannedKm, 0);
  const executedKm = dueItems.reduce((sum, item) => sum + (item.actualKm ?? 0), 0);
  const adherencePct = duePlannedKm > 0 ? (executedKm / duePlannedKm) * 100 : null;

  return {
    total: validItems.length,
    completed: completedItems.length,
    partial: partialItems.length,
    remaining: validItems.filter((item) => item.status === "future" || item.status === "today").length,
    plannedKm,
    duePlannedKm,
    executedKm,
    adherencePct,
    nextLongRun,
    biggestLongRun,
    reviewCount: items.filter((item) => item.needsReview).length,
  };
}

function PlanMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="longoes-plan-metric">
      <p className="ba-label">{label}</p>
      <p>{value}</p>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export default async function LongoesPage() {
  const [activities, sisrunData] = await Promise.all([getActivities(), getSisrunData()]);
  const longRuns = await getLongRunsFromActivities(activities);
  const summary = getLongRunSummary(longRuns);
  const marathonLongRunPlan = buildMarathonLongRunPlan(sisrunData, activities);
  const cyclePlanStats = getCyclePlanStats(marathonLongRunPlan);

  const lastLongRun = longRuns[0] ?? null;
  const previousLongRun = longRuns[1] ?? null;
  const efficiencyTrend = getEfficiencyTrend(
    lastLongRun?.efficiency,
    previousLongRun?.efficiency,
  );

  const validPaces = longRuns
    .map((r) => r.paceSecPerKm)
    .filter((p): p is number => p !== null && Number.isFinite(p));
  const bestPace = validPaces.length ? Math.min(...validPaces) : 0;
  const worstPace = validPaces.length ? Math.max(...validPaces) : 0;
  const bestPaceRun = bestPace
    ? longRuns.find((r) => r.paceSecPerKm === bestPace)
    : null;
  const longestDistanceRun = longRuns.length
    ? longRuns.reduce((best, run) =>
        run.distanceKm > best.distanceKm ? run : best,
      )
    : null;

  const validEff = longRuns
    .map((r) => r.efficiency)
    .filter((e): e is number => e !== null && Number.isFinite(e));
  const bestEffValue = validEff.length ? Math.max(...validEff) : null;
  const bestEffRun = bestEffValue !== null
    ? longRuns.find((r) => r.efficiency === bestEffValue)
    : null;

  const progressiveRuns = longRuns.filter((r, i) => {
    if (i >= longRuns.length - 1) return false;
    const prev = longRuns[i + 1];
    return (r.efficiency ?? 0) > (prev.efficiency ?? 0);
  }).length;

  const longRuns25Plus = longRuns.filter((r) => r.distanceKm >= 25).length;
  const avgDistance = summary.totalLongRuns
    ? longRuns.reduce((acc, run) => acc + run.distanceKm, 0) / summary.totalLongRuns
    : 0;

  const chartData = longRuns.map((r) => ({
    id: r.id,
    date: r.date,
    distanceKm: r.distanceKm,
    paceSecPerKm: r.paceSecPerKm,
    averageHeartrate: r.averageHeartrate,
    maxHeartrate: r.maxHeartrate,
    efficiency: r.efficiency,
  }));

  return (
    <main className="page longoes-page">
      <Navbar />
      <div className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Treinos</p>
            <h1 className="ba-title">Longões — ciclo Buenos Aires</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Plano do ciclo específico, comparação planejado × executado e histórico completo com ritmo, FC, elevação, eficiência e splits.
            </p>
          </div>

          <Link href="/" className="ba-back">
            ← Voltar ao dashboard
          </Link>
        </div>


        <section className="longoes-section longoes-cycle-section" style={{ marginBottom: "3.5rem" }}>
          <div className="ba-card ba-card--accent longoes-cycle-hero" style={{ padding: "2rem", marginBottom: "1rem" }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Road to Buenos Aires</p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white/95 md:text-4xl">
                  Central dos longões do ciclo específico
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                  A timeline cruza o maior treino planejado de cada semana no SisRUN com a corrida registrada no Strava no mesmo dia ou no fim de semana próximo.
                </p>
              </div>

              {cyclePlanStats.nextLongRun ? (
                <div className="ba-card-soft longoes-next-card" style={{ padding: "1rem 1.15rem", minWidth: "220px" }}>
                  <p className="ba-label">Próximo longão</p>
                  <p className="mt-2 text-2xl font-bold text-white/90">{formatKm(cyclePlanStats.nextLongRun.plannedKm, 0)}</p>
                  <p className="mt-1 text-sm text-white/45">
                    {cyclePlanStats.nextLongRun.weekday ? `${cyclePlanStats.nextLongRun.weekday} · ` : ""}
                    {cyclePlanStats.nextLongRun.dateLabel}
                  </p>
                </div>
              ) : (
                <div className="ba-card-soft longoes-next-card" style={{ padding: "1rem 1.15rem", minWidth: "220px" }}>
                  <p className="ba-label">Próximo longão</p>
                  <p className="mt-2 text-2xl font-bold text-white/90">—</p>
                  <p className="mt-1 text-sm text-white/45">Sem próximos longões válidos no SisRUN.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 longoes-cycle-kpis" style={{ marginBottom: "1rem" }}>
            <InfoCard
              title="Longões do ciclo"
              value={`${cyclePlanStats.completed}/${cyclePlanStats.total}`}
              sub={cyclePlanStats.remaining > 0 ? `${cyclePlanStats.remaining} pela frente` : "ciclo concluído"}
              accent="accent"
            />
            <InfoCard
              title="Planejado"
              value={formatKm(cyclePlanStats.plannedKm, 0)}
              sub="somando longões válidos"
              accent="blue"
            />
            <InfoCard
              title="Executado até agora"
              value={formatKm(cyclePlanStats.executedKm, 1)}
              sub={cyclePlanStats.adherencePct !== null ? `${Math.round(cyclePlanStats.adherencePct)}% do previsto vencido` : "sem vencidos ainda"}
              accent="success"
            />
            <InfoCard
              title="Maior estímulo"
              value={cyclePlanStats.biggestLongRun ? formatKm(cyclePlanStats.biggestLongRun.plannedKm, 0) : "—"}
              sub={cyclePlanStats.biggestLongRun ? cyclePlanStats.biggestLongRun.dateLabel : undefined}
              accent="danger"
            />
          </div>

          <div className="ba-card longoes-plan-card-wrapper" style={{ padding: "1.5rem 1.5rem 1.75rem" }}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Timeline planejada</p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white/90">
                  Planejado × executado
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Status por data, com alerta para placeholders fora do padrão.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge--accent">Buenos Aires</span>
                {cyclePlanStats.reviewCount > 0 && <span className="badge badge--purple">{cyclePlanStats.reviewCount} para revisar</span>}
              </div>
            </div>

            {marathonLongRunPlan.length === 0 ? (
              <p className="text-sm text-white/50">Nenhum longão planejado foi encontrado no SisRUN para o ciclo específico.</p>
            ) : (
              <div className="longoes-plan-grid">
                {marathonLongRunPlan.map((item) => {
                  const statusMeta = getPlanStatusMeta(item.status);
                  const diffLabel = item.diffKm !== null
                    ? `${item.diffKm >= 0 ? "+" : ""}${item.diffKm.toFixed(1).replace(".", ",")} km`
                    : "—";

                  return (
                    <article
                      key={item.key}
                      className={`ba-card-soft longoes-plan-card ${item.status === "today" || item.status === "future" ? "longoes-plan-card--upcoming" : ""} ${item.isKeyWorkout ? "longoes-plan-card--key" : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="ba-label">
                          {item.weekday ? `${item.weekday} · ` : ""}{item.shortDateLabel}
                        </p>
                        <span className={statusMeta.badge}>{statusMeta.label}</span>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${item.isRaceGoal || item.isRace ? "badge--accent" : item.isKeyWorkout ? "badge--orange" : "badge--muted"}`}>
                            {item.typeLabel}
                          </span>
                          {item.matchedActivity && <span className="badge badge--blue">Strava encontrado</span>}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold leading-snug text-white/90">{item.title}</h3>
                        <p className="mt-2 text-xs leading-5 text-white/42">{item.note}</p>
                      </div>

                      <div className="longoes-plan-metrics">
                        <PlanMetric label="Previsto" value={formatKm(item.plannedKm, item.plannedKm % 1 === 0 ? 0 : 1)} />
                        <PlanMetric label="Feito" value={item.actualKm !== null ? formatKm(item.actualKm, 1) : "—"} />
                        <PlanMetric label="Saldo" value={diffLabel} />
                      </div>

                      {item.matchedActivity && (
                        <p className="mt-3 truncate text-xs text-white/35" title={item.matchedActivity.name}>
                          {item.matchedActivity.name}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="longoes-section longoes-summary-section" style={{ marginBottom: "4rem" }}>
          <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Resumo geral</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 longoes-summary-grid">
            <InfoCard title="Total de longões" value={String(summary.totalLongRuns)} sub="desde jan/2024" />
            <InfoCard
              title="Maior distância"
              value={`${summary.longestRunKm.toFixed(1)} km`}
              sub={longestDistanceRun ? formatBRDate(longestDistanceRun.date) : undefined}
              accent="accent"
            />
            <InfoCard
              title="Melhor ritmo"
              value={formatLongRunPace(bestPace)}
              sub={bestPaceRun ? formatBRDate(bestPaceRun.date) : undefined}
              accent="blue"
            />
            <InfoCard
              title="Melhor eficiência"
              value={formatEfficiency(summary.bestEfficiency)}
              sub={bestEffRun ? formatBRDate(bestEffRun.date) : undefined}
              accent="success"
            />
            <InfoCard title="FC média geral" value={summary.averageHeartrate ? `${summary.averageHeartrate.toFixed(0)} bpm` : "—"} />
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3 longoes-section longoes-insights-grid" style={{ marginBottom: "3.5rem" }}>
          <div className="ba-card ba-card--accent min-h-[340px] longoes-insight-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow ba-section">Último longão</p>
            {lastLongRun ? (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "calc(100% - 2rem)" }}>
                <div>
                  <h2 className="max-w-[92%] text-xl font-semibold leading-snug text-white/90">
                    {lastLongRun.name}
                  </h2>
                  <p className="mt-3 text-sm text-white/45">{formatBRDate(lastLongRun.date)}</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="badge badge--accent">{lastLongRun.distanceKm.toFixed(2)} km</span>
                  <span className="badge badge--blue">{formatLongRunPace(lastLongRun.paceSecPerKm)}</span>
                  {lastLongRun.averageHeartrate && (
                    <span className="badge badge--danger">{lastLongRun.averageHeartrate.toFixed(0)} bpm</span>
                  )}
                </div>

                <div className="pt-4">
                  <PaceBar paceSecPerKm={lastLongRun.paceSecPerKm} best={bestPace} worst={worstPace} />
                  <p className="mt-3 text-xs text-white/35">Posição relativa de ritmo no histórico.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">Nenhum longão encontrado.</p>
            )}
          </div>

          <div className="ba-card min-h-[340px] longoes-insight-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Tendência de eficiência</p>
            <div className="flex items-center gap-4">
              <span className="text-3xl">{efficiencyTrend.emoji}</span>
              <div>
                <p className={`text-xl font-bold ${efficiencyTrend.tone}`}>{efficiencyTrend.label}</p>
                <p className="mt-1 text-sm text-white/45">{efficiencyTrend.detail}</p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex justify-between text-sm"><span className="text-white/45">Último</span><span className="font-semibold text-white/85">{formatEfficiency(lastLongRun?.efficiency ?? null)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/45">Anterior</span><span className="font-semibold text-white/85">{formatEfficiency(previousLongRun?.efficiency ?? null)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/45">Melhor</span><span className="font-semibold text-emerald-400">{formatEfficiency(summary.bestEfficiency)}</span></div>
            </div>
          </div>

          <div className="ba-card min-h-[340px] longoes-insight-card longoes-pattern-card" style={{ padding: "2rem" }}>
            <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Padrões identificados</p>
            <div className="space-y-5">
              <MetricPill label="Longões com melhora" value={`${progressiveRuns} em relação ao anterior`} />
              <MetricPill label="Longões 25 km+" value={`${longRuns25Plus} treinos`} />
              <MetricPill label="Distância média" value={`${avgDistance.toFixed(1)} km por longão`} />
              <MetricPill label="Elevação média" value={`${summary.averageElevationGain.toFixed(0)} m por longão`} />
            </div>
          </div>
        </section>

        <section className="ba-card longoes-section longoes-evolution-section" style={{ marginBottom: "3.5rem", padding: "1.5rem 2rem" }}>
          <p className="ba-eyebrow" style={{ marginBottom: "1.25rem" }}>Evolução</p>
          <LongRunCharts longRuns={chartData} />
        </section>

        <section className="ba-card longoes-history-card" style={{ padding: "2rem", marginTop: "0" }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="ba-eyebrow" style={{ marginBottom: ".75rem" }}>Histórico completo</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white/90">
                Longões registrados
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Do mais recente ao mais antigo — distância, ritmo, FC, elevação, eficiência e splits.
              </p>
            </div>
            <span className="badge badge--accent">{summary.totalLongRuns} longões</span>
          </div>

          {longRuns.length === 0 ? (
            <p className="text-sm text-white/50">Nenhuma atividade com nome “Longão” foi encontrada.</p>
          ) : (
            <div className="longoes-history-list" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {longRuns.map((run, index) => {
                const previous = longRuns[index + 1];
                const trend = getEfficiencyTrend(run.efficiency, previous?.efficiency);
                const effBadge = getEfficiencyBadge(run.efficiency);
                const isBest = run.efficiency === bestEffValue;

                return (
                  <div key={run.id} className={`ba-card longoes-run-card ${isBest ? "ba-card--accent" : ""}`} style={{ padding: "1.25rem 1.5rem 1.5rem" }}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-white/35">
                          {longRuns.length - index}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white/90">{run.name}</p>
                            {isBest && <span className="badge badge--accent">Melhor eficiência</span>}
                          </div>
                          <p className="mt-1 text-sm text-white/45">
                            {formatBRDate(run.date)}
                            {run.city && run.city !== "Não identificado"
                              ? ` · ${run.city}${run.state ? `, ${run.state}` : ""}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge--accent">{run.distanceKm.toFixed(2)} km</span>
                        <span className={effBadge.badge}>{effBadge.label}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 longoes-run-metrics" style={{ marginTop: "1.75rem" }}>
                      <MetricPill label="Tempo" value={formatLongRunDuration(run.movingTimeSec)} />
                      <MetricPill label="Ritmo" value={formatLongRunPace(run.paceSecPerKm)} />
                      <MetricPill label="Ritmo ajustado" value={formatLongRunPace(run.adjustedPaceSecPerKm)} />
                      <MetricPill label="FC média" value={run.averageHeartrate ? `${run.averageHeartrate.toFixed(0)} bpm` : "—"} />
                      <MetricPill label="FC máxima" value={run.maxHeartrate ? `${run.maxHeartrate} bpm` : "—"} />
                      <MetricPill label="Elevação" value={`${run.elevationGain.toFixed(0)} m`} />
                    </div>

                    <div
                      className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 longoes-efficiency-row"
                      style={{ marginTop: "1rem", paddingTop: "1rem" }}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/35">Eficiência:</span>
                          <span className="text-sm font-bold text-white/90">{formatEfficiency(run.efficiency)}</span>
                        </div>
                        <ActivitySplitsChart
                          activityId={Number(run.id)}
                          activityName={run.name}
                          targetPaceSecPerKm={run.paceSecPerKm ?? undefined}
                          goalPaceSecPerKm={BUENOS_AIRES_GOAL_PACE_SEC_PER_KM}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-sm">{trend.emoji}</span>
                        <span className={`text-xs font-medium ${trend.tone}`}>{trend.label}</span>
                        <span className="hidden text-xs text-white/35 sm:inline">{trend.detail}</span>
                      </div>
                    </div>

                    <div className="longoes-pace-block" style={{ marginTop: ".5rem", marginBottom: ".25rem" }}>
                      <PaceBar paceSecPerKm={run.paceSecPerKm} best={bestPace} worst={worstPace} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </main>
  );
}
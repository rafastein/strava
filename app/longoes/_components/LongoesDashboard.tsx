import Link from "next/link";
import { BUENOS_AIRES_DATE_KEY, getActivityLocalDateKey } from "../../lib/buenos-aires-archive";
import Navbar from "../../components/Navbar";
import { getStravaActivities, isRunActivity, type StravaActivitySummary } from "../../lib/strava-client";
import { combineSameDayRuns, type SameDayRunActivity } from "../../lib/strava-same-day-runs";
import {
  BUENOS_AIRES_GOAL_PACE_SEC_PER_KM,
  BUENOS_AIRES_RACE_DATE,
  MARATHON_CYCLE_END_DATE,
  getRaceCalendarData,
  type MarathonCycleRace,
} from "../../lib/race-calendar";
import { getBRDateKey } from "../../lib/date-utils";
import { formatDayMonth, formatKm, formatNumber, formatWeekdayLong } from "../../lib/format";
import {
  getAllStructuredPlannedWorkouts,
  isCorosPlannedWorkout,
  isStructuredRunningWorkout,
  type StructuredPlannedWorkout,
} from "../../lib/planned-workout";
import {
  formatLongRunDuration,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
} from "../../lib/strava-long-runs";
import LongRunCharts from "../../components/LongRunCharts";
import ActivitySplitsChart from "../../components/ActivitySplitsChart";
import { getCurrentSeasonYear } from "../../lib/season";

type StravaActivity = StravaActivitySummary;
type LongRunMatchedActivity = SameDayRunActivity;

const MAX_REASONABLE_LONG_RUN_KM = 45;
const MIN_PLANNED_LONG_RUN_KM = 15;
const LONG_RUN_CYCLE_START_DATE = new Date("2026-06-13T12:00:00-03:00");
const LONG_RUN_CYCLE_START_LABEL = "13/06";
const LONG_RUN_CYCLE_START_KEY = "2026-06-13";


async function getActivities(): Promise<StravaActivity[]> {
  return getStravaActivities({ maxPages: 20 });
}

function getEfficiencyTrend(
  current?: number | null,
  previous?: number | null,
): { label: string; detail: string; direction: "up" | "down" | "flat" } {
  if (!current || !previous)
    return { label: "Sem base anterior", detail: "Ainda não há longão anterior com eficiência para comparar.", direction: "flat" };

  const diff = current - previous;
  const points = formatNumber(Math.abs(diff), 1);
  if (Math.abs(diff) < 1) return { label: "Estável", detail: "Variação menor que 1 ponto contra o longão anterior.", direction: "flat" };
  if (diff > 0) return { label: "Melhorou", detail: `${points} pontos acima do longão anterior.`, direction: "up" };
  return { label: "Piorou", detail: `${points} pontos abaixo do longão anterior.`, direction: "down" };
}

function formatEff(value: number | null | undefined) {
  return value && Number.isFinite(value) ? formatNumber(value, 1) : "—";
}

function formatKmValue(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? formatKm(value, digits) : "—";
}

function DateBlock({ dateKey }: { dateKey: string }) {
  const [day, month] = formatDayMonth(dateKey).split(" ");
  return (
    <span className="ui-date">
      <span className="ui-date__day">{day}</span>
      <span className="ui-muted" style={{ fontSize: 12 }}>{month}</span>
    </span>
  );
}

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
  matchedActivity: LongRunMatchedActivity | null;
  isKeyWorkout: boolean;
  isRaceGoal: boolean;
  isRace: boolean;
  raceName?: string;
  raceLocation?: string;
  needsReview: boolean;
  sourceLabel: string;
};

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

function formatPlanWeekday(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(".", "");
}

function isRaceDistanceCompatible(plannedKm: number, raceDistanceKm: number) {
  if (!Number.isFinite(plannedKm) || plannedKm <= 0) return false;
  if (!Number.isFinite(raceDistanceKm) || raceDistanceKm <= 0) return false;

  return plannedKm >= raceDistanceKm * 0.7 && plannedKm <= raceDistanceKm * 1.35;
}

function findRaceForPlanDate(date: Date, plannedKm: number, marathonCycleRaces: MarathonCycleRace[]) {
  if (!Number.isFinite(plannedKm) || plannedKm <= 0) return null;

  const plannedDateKey = getDateKeyFromDate(date);
  const exactRace = marathonCycleRaces.find((race) => race.dateKey === plannedDateKey);
  if (exactRace && (exactRace.isGoal || isRaceDistanceCompatible(plannedKm, exactRace.distanceKm))) {
    return exactRace;
  }

  return marathonCycleRaces.find((race) => {
    const raceDate = parseDateKey(race.dateKey);
    if (!raceDate) return false;

    const sameWeekend = Math.abs(daysBetween(date, raceDate)) <= 1;
    return sameWeekend && isRaceDistanceCompatible(plannedKm, race.distanceKm);
  }) ?? null;
}

function isLongRunDistance(plannedKm: number) {
  return Number.isFinite(plannedKm) && plannedKm >= MIN_PLANNED_LONG_RUN_KM;
}

function getPlanStatusMeta(status: PlanStatus) {
  if (status === "done") return { label: "Cumprido", color: "var(--ui-good)" };
  if (status === "partial") return { label: "Parcial", color: "var(--ui-accent)" };
  if (status === "missed") return { label: "Perdido", color: "#ff8a7a" };
  if (status === "today") return { label: "Hoje", color: "var(--ui-accent)" };
  if (status === "review") return { label: "Revisar COROS", color: "#b9a6ff" };
  return { label: "Futuro", color: "var(--ui-blue)" };
}

function getLongRunTypeLabel(plannedKm: number, isRaceGoal: boolean, isRace: boolean) {
  if (isRaceGoal) return "Prova-alvo";
  if (isRace) return "Longão em prova";
  if (plannedKm >= 30) return "Longão-chave";
  if (plannedKm >= 25) return "Longão específico";
  if (plannedKm >= 21) return "Longão controlado";
  return "Controle de ciclo";
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
): LongRunMatchedActivity | null {
  if (!Number.isFinite(plannedKm) || plannedKm <= 0 || plannedKm > MAX_REASONABLE_LONG_RUN_KM) {
    return null;
  }

  const minDistanceToMatch = Math.max(6, plannedKm * 0.5);

  const candidates = combineSameDayRuns(activities)
    .filter(isRunActivity)
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

function getStructuredLongRunSourceLabel() {
  return "Upstash/COROS";
}

function buildStructuredLongRunPlanItems(
  structuredWorkouts: StructuredPlannedWorkout[],
  activities: StravaActivity[],
  seenDates: Set<string>,
  marathonCycleRaces: MarathonCycleRace[],
): MarathonLongRunPlanItem[] {
  return structuredWorkouts
    .filter(isCorosPlannedWorkout)
    .filter((workout) => isStructuredRunningWorkout(workout))
    .map((workout) => {
      const plannedKm = Number(workout.distanceKm ?? 0);
      const date = parseDateKey(workout.date);
      if (!date || !Number.isFinite(plannedKm) || plannedKm <= 0) return null;
      if (date < LONG_RUN_CYCLE_START_DATE || date > MARATHON_CYCLE_END_DATE) return null;

      const isExplicitLong = workout.type === "longao" || workout.type === "prova_longa";
      const isShortOrQualityWorkout = ["prova_curta", "intervalado", "fartlek", "ritmo", "regenerativo"].includes(workout.type);
      const isLongByDistance = isLongRunDistance(plannedKm) && !isShortOrQualityWorkout;
      if (!isExplicitLong && !isLongByDistance) return null;

      const dateKey = getDateKeyFromDate(date);
      if (seenDates.has(dateKey)) return null;
      seenDates.add(dateKey);

      const race = findRaceForPlanDate(date, plannedKm, marathonCycleRaces);
      const isRaceGoal = Boolean(race?.isGoal) || (Math.abs(daysBetween(date, BUENOS_AIRES_RACE_DATE)) <= 1 && plannedKm >= 40);
      if (isRaceGoal) return null;

      const isRace = Boolean(workout.type === "prova_longa" || workout.type === "prova_curta" || race);
      const needsReview = plannedKm > MAX_REASONABLE_LONG_RUN_KM;
      const matchedActivity = findMatchingRun(date, plannedKm, activities);
      const actualKm = matchedActivity ? matchedActivity.distance / 1000 : null;
      const diffKm = actualKm !== null ? actualKm - plannedKm : null;
      const status = getPlanStatus({ date, plannedKm, actualKm, needsReview });
      const typeLabel = getLongRunTypeLabel(plannedKm, isRaceGoal, isRace);
      const sourceLabel = getStructuredLongRunSourceLabel();

      const planItem: MarathonLongRunPlanItem = {
        key: dateKey,
        date,
        dateLabel: formatPlanDate(date),
        shortDateLabel: formatShortPlanDate(date),
        weekday: formatPlanWeekday(date),
        weekLabel: "Upstash/COROS",
        plannedKm,
        actualKm,
        diffKm,
        status,
        title: isRaceGoal ? "Maratona de Buenos Aires" : workout.title,
        typeLabel,
        note: "",
        matchedActivity,
        isKeyWorkout: plannedKm >= 30 || isRaceGoal || isRace,
        isRaceGoal,
        isRace,
        raceName: race?.name,
        raceLocation: race?.location,
        needsReview,
        sourceLabel,
      };

      return {
        ...planItem,
        note: getLongRunNote(planItem),
      };
    })
    .filter((item): item is MarathonLongRunPlanItem => Boolean(item));
}


function buildMarathonLongRunPlan(
  activities: StravaActivity[],
  structuredWorkouts: StructuredPlannedWorkout[] = [],
  marathonCycleRaces: MarathonCycleRace[] = [],
): MarathonLongRunPlanItem[] {
  const seenDates = new Set<string>();

  return buildStructuredLongRunPlanItems(
    structuredWorkouts,
    activities,
    seenDates,
    marathonCycleRaces,
  ).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getCyclePlanStats(items: MarathonLongRunPlanItem[]) {
  const validItems = items.filter((item) => !item.needsReview);
  const dueItems = validItems.filter((item) => item.date <= getTodayInBrazil());
  const completedItems = validItems.filter((item) => item.status === "done");
  const partialItems = validItems.filter((item) => item.status === "partial");
  const nextLongRun = validItems.find((item) => item.status === "future" || item.status === "today") ?? null;
  const upcomingItems = validItems.filter((item) => item.status === "future" || item.status === "today");
  const stimulusItems = validItems.filter((item) => !item.isRaceGoal);
  const biggestLongRun = stimulusItems.length
    ? stimulusItems.reduce((best, item) => (item.plannedKm > best.plannedKm ? item : best))
    : null;

  const plannedKm = validItems.reduce((sum, item) => sum + item.plannedKm, 0);
  const duePlannedKm = dueItems.reduce((sum, item) => sum + item.plannedKm, 0);
  const executedKm = dueItems.reduce((sum, item) => sum + (item.actualKm ?? 0), 0);
  const adherencePct = duePlannedKm > 0 ? (executedKm / duePlannedKm) * 100 : null;

  return {
    total: validItems.length,
    completed: completedItems.length,
    partial: partialItems.length,
    remaining: upcomingItems.length,
    plannedKm,
    duePlannedKm,
    executedKm,
    adherencePct,
    nextLongRun,
    biggestLongRun,
    reviewCount: items.filter((item) => item.needsReview).length,
  };
}

export default async function LongoesPage() {
  const [activities, structuredPlanResults, raceCalendarData] = await Promise.all([
    getActivities(),
    getAllStructuredPlannedWorkouts(),
    getRaceCalendarData(),
  ]);
  const structuredWorkouts = structuredPlanResults
    .filter((result) => isCorosPlannedWorkout(result.data))
    .map((result) => ({
      ...result.data!,
      // A data confiável é a data da chave do Upstash.
      // Alguns treinos antigos podem ter sido salvos com a data interna deslocada pelo parser do COROS.
      date: result.date,
    } satisfies StructuredPlannedWorkout));
  const allLongRuns = await getLongRunsFromActivities(activities);
  const longRuns = allLongRuns.filter((run) => getBRDateKey(run.date) >= LONG_RUN_CYCLE_START_KEY);
  const summary = getLongRunSummary(longRuns);
  const cycleActivities = activities.filter((activity) => {
    const dateKey = getActivityLocalDateKey(activity);
    return dateKey >= LONG_RUN_CYCLE_START_KEY && dateKey < BUENOS_AIRES_DATE_KEY;
  });
  const marathonLongRunPlan = buildMarathonLongRunPlan(cycleActivities, structuredWorkouts, raceCalendarData.marathonCycleRaces);
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

  const chartData = allLongRuns.map((r) => ({
    id: r.id,
    date: r.date,
    distanceKm: r.distanceKm,
    paceSecPerKm: r.paceSecPerKm,
    averageHeartrate: r.averageHeartrate,
    maxHeartrate: r.maxHeartrate,
    efficiency: r.efficiency,
  }));

  const trendColor = { up: "var(--ui-good)", down: "#ff8a7a", flat: "var(--ui-text-2)" }[efficiencyTrend.direction];
  const lastDateKey = lastLongRun ? getBRDateKey(lastLongRun.date) : "";

  return (
    <div className="ui-page">
      <Navbar />

      <main className="ui-container">
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Longões</h1>
            <p className="ui-muted">
              {summary.totalLongRuns} {summary.totalLongRuns === 1 ? "longão" : "longões"} desde {LONG_RUN_CYCLE_START_LABEL}
            </p>
          </div>
        </header>

        <div className="hoje-grid">
          <div className="hoje-col">
            {/* ── Último longão ── */}
            <section className="ui-card ui-card--pad ui-stack" aria-label="Último longão">
              <p className="ui-label-accent">Último longão</p>
              {lastLongRun ? (
                <>
                  <div>
                    <h2 className="hoje-race__title" style={{ fontSize: 24 }}>{lastLongRun.name}</h2>
                    <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>
                      {formatWeekdayLong(lastDateKey)}, {formatDayMonth(lastDateKey)} · {formatLongRunDuration(lastLongRun.movingTimeSec)}
                    </p>
                  </div>
                  <dl className="ui-dl" style={{ paddingTop: 16, borderTop: "1px solid var(--ui-border)" }}>
                    <div><dt>Distância</dt><dd>{formatKmValue(lastLongRun.distanceKm, 2)}</dd></div>
                    <div><dt>Ritmo</dt><dd>{formatLongRunPace(lastLongRun.paceSecPerKm)}</dd></div>
                    <div><dt>FC média</dt><dd>{lastLongRun.averageHeartrate ? `${formatNumber(lastLongRun.averageHeartrate)} bpm` : "—"}</dd></div>
                    <div><dt>Eficiência</dt><dd>{formatEff(lastLongRun.efficiency)}</dd></div>
                  </dl>
                  <p style={{ fontSize: 14 }}>
                    <strong style={{ color: trendColor }}>Eficiência: {efficiencyTrend.label.toLowerCase()}.</strong>{" "}
                    <span className="ui-muted" style={{ fontSize: 14 }}>{efficiencyTrend.detail}</span>
                  </p>
                </>
              ) : (
                <p className="ui-muted">Nenhuma atividade com “Longão” no nome foi encontrada no período.</p>
              )}
            </section>

            {/* ── Resumo ── */}
            <section className="ui-section" aria-label="Resumo">
              <div className="ui-section__head">
                <h2 className="ui-h2">Resumo</h2>
              </div>
              <div className="ui-stat-grid">
                {[
                  { label: "maior distância", value: longestDistanceRun ? formatKmValue(summary.longestRunKm) : "—", sub: longestDistanceRun ? formatDayMonth(getBRDateKey(longestDistanceRun.date)) : null },
                  { label: "melhor ritmo", value: bestPace ? formatLongRunPace(bestPace) : "—", sub: bestPaceRun ? formatDayMonth(getBRDateKey(bestPaceRun.date)) : null },
                  { label: "melhor eficiência", value: formatEff(bestEffValue), sub: bestEffRun ? formatDayMonth(getBRDateKey(bestEffRun.date)) : null },
                  { label: "distância média", value: summary.totalLongRuns ? formatKmValue(avgDistance) : "—", sub: null },
                  { label: "FC média", value: summary.averageHeartrate ? `${formatNumber(summary.averageHeartrate)} bpm` : "—", sub: null },
                  { label: "subida média", value: summary.totalLongRuns ? `${formatNumber(summary.averageElevationGain)} m` : "—", sub: null },
                ].map((stat) => (
                  <div key={stat.label} className="ui-stat">
                    <span className="ui-stat__value">{stat.value}</span>
                    <span className="ui-stat__label">{stat.label}{stat.sub ? ` · ${stat.sub}` : ""}</span>
                  </div>
                ))}
              </div>
              <p className="ui-muted" style={{ padding: "0 4px" }}>
                {longRuns25Plus} de 25 km ou mais · {progressiveRuns} com eficiência melhor que o anterior
              </p>
            </section>
          </div>

          <div className="hoje-col">
            {/* ── Evolução ── */}
            <section className="ui-section" style={{ paddingTop: 0 }} aria-label="Evolução">
              <LongRunCharts longRuns={chartData} />
            </section>
          </div>
        </div>

        {/* ── Histórico ── */}
        <section className="ui-section" style={{ marginTop: 12 }} aria-label="Histórico de longões">
          <div className="ui-section__head">
            <h2 className="ui-h2">Histórico</h2>
            <span className="ui-muted">toque para ver detalhes e splits</span>
          </div>
          {longRuns.length === 0 ? (
            <p className="ui-card ui-card--pad ui-muted">Nenhuma atividade com “Longão” no nome foi encontrada no período.</p>
          ) : (
            <div className="ui-card ui-list">
              {longRuns.map((run, index) => {
                const previous = longRuns[index + 1];
                const trend = getEfficiencyTrend(run.efficiency, previous?.efficiency);
                const isBest = run.efficiency !== null && run.efficiency === bestEffValue;
                const dateKey = getBRDateKey(run.date);
                const place = run.city && run.city !== "Não identificado" ? `${run.city}${run.state ? `, ${run.state}` : ""}` : null;

                return (
                  <details key={run.id} className="ui-acc">
                    <summary className="ui-row ui-row--date">
                      <DateBlock dateKey={dateKey} />
                      <span className="ui-row__main">
                        <span className="ui-row__title">{run.name}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>
                          {[formatLongRunDuration(run.movingTimeSec), place, isBest ? "melhor eficiência" : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="ui-row__side">
                        <span className="ui-row__value">{formatKmValue(run.distanceKm, 2)}</span>
                        <span className="ui-muted">{formatLongRunPace(run.paceSecPerKm)}</span>
                      </span>
                    </summary>
                    <div className="ui-acc__body">
                      <dl className="ui-dl">
                        <div><dt>Ritmo ajustado</dt><dd>{formatLongRunPace(run.adjustedPaceSecPerKm)}</dd></div>
                        <div><dt>FC média</dt><dd>{run.averageHeartrate ? `${formatNumber(run.averageHeartrate)} bpm` : "—"}</dd></div>
                        <div><dt>FC máxima</dt><dd>{run.maxHeartrate ? `${formatNumber(run.maxHeartrate)} bpm` : "—"}</dd></div>
                        <div><dt>Subida</dt><dd>{formatNumber(run.elevationGain)} m</dd></div>
                        <div><dt>Eficiência</dt><dd>{formatEff(run.efficiency)}</dd></div>
                        <div><dt>Contra o anterior</dt><dd style={{ fontSize: 14 }}>{trend.label}</dd></div>
                      </dl>
                      {typeof run.id === "number" && !run.name.includes("consolidado") ? (
                        <ActivitySplitsChart
                          activityId={run.id}
                          activityName={run.name}
                          targetPaceSecPerKm={run.paceSecPerKm ?? undefined}
                          goalPaceSecPerKm={getActivityLocalDateKey({ start_date_local: run.date }) < BUENOS_AIRES_DATE_KEY ? BUENOS_AIRES_GOAL_PACE_SEC_PER_KM : undefined}
                        />
                      ) : (
                        <p className="ui-muted">Corridas do mesmo dia somadas; sem splits.</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Ciclo de Buenos Aires, arquivado ── */}
        <details id="ciclo-buenos-aires" className="ui-card ui-details" style={{ marginTop: 24 }}>
          <summary>
            Ciclo Buenos Aires 2026 · planejado × executado
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="ui-details__body">
            <p>
              Planejamento de {LONG_RUN_CYCLE_START_LABEL} a 20/09/2026, importado do COROS e preservado para comparar com o que foi feito.{" "}
              <Link href="/buenos-aires" style={{ color: "var(--ui-accent)" }}>Rever a maratona</Link>
            </p>
            <dl className="ui-dl">
              <div><dt>Longões cumpridos</dt><dd>{cyclePlanStats.completed} de {cyclePlanStats.total}</dd></div>
              <div><dt>Planejado</dt><dd>{formatKmValue(cyclePlanStats.plannedKm, 0)}</dd></div>
              <div>
                <dt>Executado</dt>
                <dd>
                  {formatKmValue(cyclePlanStats.executedKm)}
                  {cyclePlanStats.adherencePct !== null ? ` · ${Math.round(cyclePlanStats.adherencePct)}%` : ""}
                </dd>
              </div>
              <div>
                <dt>Maior estímulo</dt>
                <dd>{cyclePlanStats.biggestLongRun ? formatKmValue(cyclePlanStats.biggestLongRun.plannedKm, 0) : "—"}</dd>
              </div>
            </dl>
            {cyclePlanStats.reviewCount > 0 ? (
              <p className="ui-muted">{cyclePlanStats.reviewCount} com distância fora do padrão, para revisar no COROS.</p>
            ) : null}

            {marathonLongRunPlan.length === 0 ? (
              <p className="ui-muted">Nenhum longão planejado foi encontrado no COROS para este ciclo.</p>
            ) : (
              <div className="ui-list" style={{ margin: "0 -20px" }}>
                {marathonLongRunPlan.map((item) => {
                  const statusMeta = getPlanStatusMeta(item.status);
                  return (
                    <div key={item.key} className="ui-row ui-row--date" style={{ padding: "8px 20px" }}>
                      <DateBlock dateKey={item.key} />
                      <span className="ui-row__main">
                        <span className="ui-row__title">{item.title}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>
                          {item.typeLabel} · previsto {formatKmValue(item.plannedKm, item.plannedKm % 1 === 0 ? 0 : 1)}
                        </span>
                      </span>
                      <span className="ui-row__side">
                        <span className="ui-row__value">{item.actualKm !== null ? formatKmValue(item.actualKm) : "—"}</span>
                        <span style={{ fontSize: 12, color: statusMeta.color }}>{statusMeta.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </main>

      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

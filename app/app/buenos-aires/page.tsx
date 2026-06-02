export const dynamic = "force-dynamic";

import Navbar from "../components/Navbar";
import MarathonProjection from "../components/MarathonProjection";
import WeeklyPlanVsActualChart from "../components/WeeklyPlanVsActualChart";
import ZonesAggregate from "../components/ZonesAggregate";
import TodayWorkoutCard from "../components/TodayWorkoutCard";
import WeeklyGoalCard from "../components/WeeklyGoalCard";

import { getValidStravaAccessToken } from "../lib/strava-auth";
import { isLongRunActivityName } from "../lib/strava-long-runs";
import { getDynamicAthleteProfile } from "../lib/strava-prs";
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
import { getBRDate, getActivityDate } from "../lib/date-utils";

import BuenosAiresHero from "./_components/BuenosAiresHero";
import CyclePhaseSection, {
  getMarathonCyclePhase,
} from "./_components/CyclePhaseSection";
import PerformanceSection from "./_components/PerformanceSection";
import ProjectionSection from "./_components/ProjectionSection";
import RecentLongRunsSection from "./_components/RecentLongRunsSection";
import ReadinessSection from "./_components/ReadinessSection";
import StrategicSummarySection from "./_components/StrategicSummarySection";
import {
  PROJECTION_LONG_RUN_MIN_KM,
  buildMarathonAlerts,
  buildProjectionLongRuns,
  daysUntil,
  formatDate,
  formatDurationShort,
  formatFullDuration,
  formatSecondsPerKm,
  getActivities,
  getActivityDetail,
  getIdealWeeklyVolume,
  getManualPredictions,
  getReadinessStatus,
  marathonTimeFromPace,
  predictBySiteModelDetails,
  predictFromHalf,
  predictFromLongRun,
} from "./_buenosAiresUtils";

export default async function BuenosAiresPage() {
  const accessToken = await getValidStravaAccessToken();

  const [activities, manualPredictions, sisrunData, athleteProfile] =
    await Promise.all([
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

  const daysToRace = daysUntil(marathonGoal.date);
  const weeksToRace = Math.max(1, Math.ceil(daysToRace / 7));
  const marathonCycle = getMarathonCyclePhase({
    raceDate: marathonGoal.date,
    weeksToRace,
  });

  const runs = activities.filter((activity) => activity.type === "Run");

  const longestRun = runs.length
    ? runs.reduce((max, activity) =>
        activity.distance > max.distance ? activity : max,
      )
    : null;

  const longestRunKm = longestRun ? longestRun.distance / 1000 : 0;

  const weekMap = new Map<
    string,
    {
      label: string;
      distanceKm: number;
    }
  >();

  runs.forEach((activity) => {
    const date = getBRDate(getActivityDate(activity));
    if (!date) return;

    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString();
    const current = weekMap.get(key);

    if (current) {
      current.distanceKm += activity.distance / 1000;
    } else {
      weekMap.set(key, {
        label: formatWeekLabel(weekStart),
        distanceKm: activity.distance / 1000,
      });
    }
  });

  const weeklyData = Array.from(weekMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-10)
    .map(([, value]) => ({
      label: value.label,
      distanceKm: Number(value.distanceKm.toFixed(1)),
    }));

  const weeklyComparison = buildWeeklyComparison(sisrunData, activities, 16)
    .slice()
    .reverse();

  const currentWeekKm = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm = getTodayStravaKm(activities);

  const plannedWeekKm = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct =
    plannedWeekKm > 0 ? (currentWeekKm / plannedWeekKm) * 100 : 0;

  const targetPaceLabel = formatSecondsPerKm(
    marathonGoal.targetPaceSecondsPerKm,
  );
  const targetPredictionSeconds = marathonTimeFromPace(
    marathonGoal.targetPaceSecondsPerKm,
  );

  const longRuns28Plus = runs.filter((activity) => activity.distance >= 28000);
  const idealWeekKm = getIdealWeeklyVolume(daysToRace);

  const readiness = getReadinessStatus({
    currentWeekKm,
    idealWeekKm,
    longestRunKm,
    longRuns28Plus: longRuns28Plus.length,
  });

  const bestHalf =
    runs
      .filter((activity) => {
        const km = activity.distance / 1000;
        return km >= 20 && km <= 22;
      })
      .sort((a, b) => a.moving_time - b.moving_time)[0] ?? null;

  const racePointsForProjection = runs
    .filter((activity) => {
      const km = activity.distance / 1000;
      return km >= 9.5 && km <= 22.5;
    })
    .map((activity) => ({
      date: activity.start_date_local,
      name: activity.name,
      distanceKm: activity.distance / 1000,
      paceSeconds: Math.round(activity.moving_time / (activity.distance / 1000)),
    }))
    .filter((race) => race.paceSeconds > 200 && race.paceSeconds < 500)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const predictedFromHalf = predictFromHalf(bestHalf);
  const predictedFromLongRun = predictFromLongRun(longestRun);
  const sitePrediction = predictBySiteModelDetails({
    bestHalf,
    longestRun,
    weeklyData,
  });

  const vdot = athleteProfile?.vdot ?? null;
  const vo2max = athleteProfile?.vo2max ?? null;
  const marathonPaces = athleteProfile?.paces.marathon ?? null;
  const trainingPaces = vdot ? trainingPacesFromVdot(vdot) : null;

  const recentLongRunsBase = runs
    .filter((activity) => activity.distance >= 14000 && isLongRunActivityName(activity.name))
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
        const detail = await getActivityDetail(run.id, accessToken);
        if (detail?.average_heartrate) return { ...run, ...detail };
      }

      return run;
    }),
  );

  const projRunsBase = runs
    .filter(
      (activity) =>
        activity.distance / 1000 >= PROJECTION_LONG_RUN_MIN_KM &&
        isLongRunActivityName(activity.name),
    )
    .sort(
      (a, b) =>
        new Date(getActivityDate(a)).getTime() -
        new Date(getActivityDate(b)).getTime(),
    );

  const projRunsEnriched = await Promise.all(
    projRunsBase.map(async (run) => {
      if (run.average_heartrate) return run;

      if (accessToken) {
        const detail = await getActivityDetail(run.id, accessToken);
        if (detail?.average_heartrate) return { ...run, ...detail };
      }

      return run;
    }),
  );

  const projectionLongRuns = buildProjectionLongRuns(
    projRunsBase,
    projRunsEnriched,
  );

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

  const weeklyGoalAlerts = alerts.map((alert) => ({
    title: alert.title,
    text: alert.text,
    ok:
      alert.title.toLowerCase().includes("bem encaminhado") ||
      alert.title.toLowerCase().includes("ok"),
  }));

  const weeklyAdherenceForUi = Number.isFinite(weeklyAdherencePct)
    ? Math.min(weeklyAdherencePct, 100)
    : 0;

  const trainingPaceItems = trainingPaces
    ? [
        {
          label: "Regenerativo / Fácil",
          value: `${formatSecondsPerKm(trainingPaces.easy.min)}–${formatSecondsPerKm(
            trainingPaces.easy.max,
          )}`,
        },
        {
          label: "Pace de maratona",
          value: `${formatSecondsPerKm(trainingPaces.marathon.min)}–${formatSecondsPerKm(
            trainingPaces.marathon.max,
          )}`,
        },
        {
          label: "Limiar",
          value: `${formatSecondsPerKm(trainingPaces.threshold.min)}–${formatSecondsPerKm(
            trainingPaces.threshold.max,
          )}`,
        },
        {
          label: "Intervalado",
          value: formatSecondsPerKm(trainingPaces.interval),
        },
      ]
    : [];

  const recentLongRunItems = recentLongRuns.slice(0, 4).map((run) => {
    const km = run.distance / 1000;
    const heartRate = run.average_heartrate;

    return {
      id: run.id,
      name: run.name,
      dateLabel: formatDate(run.start_date_local),
      distanceLabel: `${km.toFixed(1)} km`,
      paceLabel: formatSecondsPerKm(run.moving_time / km),
      heartRateLabel: heartRate ? `${Math.round(heartRate)} bpm` : undefined,
      elevationLabel:
        run.total_elevation_gain > 0
          ? `+${Math.round(run.total_elevation_gain)} m`
          : undefined,
    };
  });

  const weekSummaryText = sisrunWeek
    ? `${currentWeekKm.toFixed(1)} km executados de ${plannedWeekKm.toFixed(
        1,
      )} km planejados.`
    : "Sem SisRUN carregado para a semana.";

  return (
    <>
      <Navbar />

      <main className="ba-page">
        <BuenosAiresHero
          targetPaceLabel={targetPaceLabel}
          targetPredictionLabel={formatDurationShort(targetPredictionSeconds)}
          cyclePhaseName={marathonCycle.phase.label}
        />

        <CyclePhaseSection
          raceDate={marathonGoal.date}
          daysToRace={daysToRace}
          weeksToRace={weeksToRace}
          currentWeekKm={currentWeekKm}
          plannedWeekKm={plannedWeekKm}
          currentWeekLongestRunKm={currentWeekLongestRunKm}
          longestRunKm={longestRunKm}
          longRuns28Plus={longRuns28Plus.length}
          weeklyAdherencePct={weeklyAdherencePct}
        />


        <section className="ba-grid-2 ba-week-overview">
          <div className="ba-today-readiness-stack">
            <TodayWorkoutCard
              todaySisrunRow={todaySisrunRow}
              todayStravaKm={todayStravaKm}
            />

            <ReadinessSection
              dotClassName={readiness.dot}
              label={readiness.label}
              title={readiness.title}
              description={readiness.description}
              cycleDescription={marathonCycle.phase.description}
            />
          </div>

          <WeeklyGoalCard
            currentKm={currentWeekKm}
            plannedKm={plannedWeekKm}
            progressPct={weeklyAdherenceForUi}
            alerts={weeklyGoalAlerts}
            eyebrow="SisRUN x Strava"
            title="Meta semanal"
            subtitle="Volume planejado contra execução real da semana."
          />
        </section>

        <section className="ba-performance-projection-grid ba-section">
          {vdot && trainingPaces && (
            <PerformanceSection
              vdot={vdot}
              vo2max={vo2max}
              marathonPaceLabel={
                marathonPaces
                  ? `${formatSecondsPerKm(marathonPaces.min)}–${formatSecondsPerKm(
                      marathonPaces.max,
                    )}`
                  : targetPaceLabel
              }
              trainingPaces={trainingPaceItems}
            />
          )}

          <ProjectionSection
            targetPredictionLabel={formatFullDuration(targetPredictionSeconds)}
            targetPaceLabel={targetPaceLabel}
            bestHalfPredictionLabel={
              predictedFromHalf ? formatFullDuration(predictedFromHalf) : "—"
            }
            bestHalfCaption={
              bestHalf
                ? `${formatDate(bestHalf.start_date_local)} · ${(
                    bestHalf.distance / 1000
                  ).toFixed(1)} km`
                : "Sem meia identificada"
            }
            longRunPredictionLabel={
              predictedFromLongRun ? formatFullDuration(predictedFromLongRun) : "—"
            }
            longRunCaption={
              longestRun
                ? `${longestRunKm.toFixed(1)} km · ${formatSecondsPerKm(
                    longestRun.moving_time / longestRunKm,
                  )}`
                : "Sem longão identificado"
            }
            sitePredictionLabel={
              sitePrediction.seconds ? formatFullDuration(sitePrediction.seconds) : "—"
            }
            sitePredictionCaption={sitePrediction.caption}
            manualPredictionInitialValue={
              manualPredictions.stravaMarathonPrediction
            }
          />
        </section>

        <RecentLongRunsSection recentLongRuns={recentLongRunItems} />

        {projectionLongRuns.length >= 1 && (
          <section style={{ marginBottom: "1rem" }}>
            <MarathonProjection
              longRuns={projectionLongRuns}
              
              races={racePointsForProjection}
            />
          </section>
        )}

        {weeklyComparison.length > 0 && (
          <section style={{ marginBottom: "1rem" }}>
            <WeeklyPlanVsActualChart
              weeks={weeklyComparison.map((week) => ({
                label: week.label,
                planned: week.plannedKm,
                actual: week.executedKm,
              }))}
              title="Volume semanal — planejado vs. executado"
            />
          </section>
        )}

        <section style={{ marginBottom: "1rem" }}>
          <ZonesAggregate />
        </section>

        <StrategicSummarySection
          cyclePhaseName={marathonCycle.phase.label}
          readinessLabel={readiness.label}
          targetPaceLabel={targetPaceLabel}
          weekText={weekSummaryText}
        />
      </main>

      <footer className="site-footer">
        STRAVA · RAFAEL CABRAL · BUENOS AIRES 2026
      </footer>
    </>
  );
}

export const dynamic = "force-dynamic";

import Navbar from "../components/Navbar";
import MarathonProjection from "../components/MarathonProjection";
import WeeklyPlanVsActualChart from "../components/WeeklyPlanVsActualChart";
import ZonesAggregate from "../components/ZonesAggregate";
import MetricCard from "../components/MetricCard";
import TodayWorkoutCard from "../components/TodayWorkoutCard";
import WeeklyGoalCard from "../components/WeeklyGoalCard";
import { getValidStravaAccessToken } from "../lib/strava-auth";
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
import PerformanceSection from "./_components/PerformanceSection";
import ProjectionSection from "./_components/ProjectionSection";
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
  getAthlete,
  getCyclePhase,
  getIdealWeeklyVolume,
  getManualPredictions,
  getReadinessStatus,
  marathonTimeFromPace,
  predictBySiteModel,
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
    else {
      weekMap.set(key, {
        label: formatWeekLabel(ws),
        distanceKm: a.distance / 1000,
      });
    }
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
  const targetPaceLabel = formatSecondsPerKm(
    marathonGoal.targetPaceSecondsPerKm,
  );
  const targetPredictionSeconds = marathonTimeFromPace(
    marathonGoal.targetPaceSecondsPerKm,
  );
  const longRuns28Plus = runs.filter((a) => a.distance >= 28000);
  const idealWeekKm = getIdealWeeklyVolume(daysToRace);

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

  const vdot = athleteProfile?.vdot ?? null;
  const vo2max = athleteProfile?.vo2max ?? null;
  const marathonPaces = athleteProfile?.paces.marathon ?? null;
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

  const weeklyAdherenceForUi = Number.isFinite(weeklyAdherencePct)
    ? Math.min(weeklyAdherencePct, 100)
    : 0;

  const trainingPaceItems = trainingPaces
    ? [
        {
          label: "Regenerativo / Fácil",
          value: `${formatSecondsPerKm(trainingPaces.easy.min)}–${formatSecondsPerKm(trainingPaces.easy.max)}`,
        },
        {
          label: "Pace de maratona",
          value: `${formatSecondsPerKm(trainingPaces.marathon.min)}–${formatSecondsPerKm(trainingPaces.marathon.max)}`,
        },
        {
          label: "Limiar",
          value: `${formatSecondsPerKm(trainingPaces.threshold.min)}–${formatSecondsPerKm(trainingPaces.threshold.max)}`,
        },
        {
          label: "Intervalado",
          value: formatSecondsPerKm(trainingPaces.interval),
        },
      ]
    : [];

  const recentLongRunItems = recentLongRuns.slice(0, 4).map((run) => {
    const km = run.distance / 1000;
    const hr = run.average_heartrate;

    return {
      id: run.id,
      name: run.name,
      dateLabel: formatDate(run.start_date_local),
      distanceLabel: `${km.toFixed(1)} km`,
      paceLabel: formatSecondsPerKm(run.moving_time / km),
      heartRateLabel: hr ? `${Math.round(hr)} bpm` : undefined,
      elevationLabel:
        run.total_elevation_gain > 0
          ? `+${Math.round(run.total_elevation_gain)} m`
          : undefined,
    };
  });

  const weekSummaryText = sisrunWeek
    ? `${currentWeekKm.toFixed(1)} km executados de ${plannedWeekKm.toFixed(1)} km planejados.`
    : "Sem SisRUN carregado para a semana.";

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

      <div className="ba-page">
        <BuenosAiresHero
          targetPaceLabel={targetPaceLabel}
          targetPredictionLabel={formatDurationShort(targetPredictionSeconds)}
          cyclePhaseName={cyclePhase.name}
        />

        <section className="ba-grid-4" style={{ marginBottom: "1rem" }}>
          <MetricCard
            label="Semana planejada"
            value={sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "—"}
          />
          <MetricCard
            label="Executado"
            value={`${currentWeekKm.toFixed(1)} km`}
            accent
          />
          <MetricCard
            label="Aderência"
            value={
              sisrunWeek
                ? `${Math.min(weeklyAdherencePct, 100).toFixed(0)}%`
                : "—"
            }
          />
          <MetricCard
            label="Longão semana"
            value={`${currentWeekLongestRunKm.toFixed(1)} / ${sisrunWeek ? sisrunWeek.longRunPlannedKm.toFixed(1) : "—"}`}
            caption="km feito / previsto"
          />
        </section>

        <ReadinessSection
          dotClassName={readiness.dot}
          label={readiness.label}
          title={readiness.title}
          description={readiness.description}
          cycleDescription={cyclePhase.description}
        />

        <section className="ba-week" style={{ marginBottom: "1rem" }}>
          <TodayWorkoutCard
            todaySisrunRow={todaySisrunRow}
            todayStravaKm={todayStravaKm}
          />

          <WeeklyGoalCard
            currentKm={currentWeekKm}
            plannedKm={plannedWeekKm}
            progressPct={weeklyAdherenceForUi}
            alerts={alerts.slice(0, 2)}
          />
        </section>

        {vdot && trainingPaces && (
          <PerformanceSection
            vdot={vdot}
            vo2max={vo2max}
            marathonPaceLabel={
              marathonPaces
                ? `${formatSecondsPerKm(marathonPaces.min).replace("/km", "")}–${formatSecondsPerKm(marathonPaces.max).replace("/km", "")}`
                : "—"
            }
            trainingPaces={trainingPaceItems}
          />
        )}

        <ProjectionSection
          targetPredictionLabel={formatFullDuration(targetPredictionSeconds)}
          targetPaceLabel={targetPaceLabel}
          bestHalfPredictionLabel={
            predictedFromHalf && bestHalf
              ? formatFullDuration(predictedFromHalf)
              : "Sem dado"
          }
          bestHalfCaption={
            predictedFromHalf && bestHalf ? `${bestHalf.name}` : "Sem meia válida."
          }
          longRunPredictionLabel={
            predictedFromLongRun && longestRun
              ? formatFullDuration(predictedFromLongRun)
              : "Sem dado"
          }
          longRunCaption={
            predictedFromLongRun && longestRun
              ? `${(longestRun.distance / 1000).toFixed(1)} km`
              : "Falta longão robusto."
          }
          sitePredictionLabel={
            predictedBySite ? formatFullDuration(predictedBySite) : "Sem dado"
          }
          manualPredictionInitialValue={manualPredictions.stravaMarathonPrediction}
          recentLongRuns={recentLongRunItems}
        />

        {projectionLongRuns.length >= 3 && (
          <section style={{ marginBottom: "1rem" }}>
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

        <section style={{ marginBottom: "1rem" }}>
          <ZonesAggregate />
        </section>

        <StrategicSummarySection
          cyclePhaseName={cyclePhase.name}
          readinessLabel={readiness.label}
          targetPaceLabel={targetPaceLabel}
          weekText={weekSummaryText}
        />
      </div>

      <footer className="site-footer">
        STRAVA · RAFAEL CABRAL · BUENOS AIRES 2026
      </footer>
    </main>
  );
}

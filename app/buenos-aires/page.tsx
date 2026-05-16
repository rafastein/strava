export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import ManualPredictionForm from "../components/ManualPredictionForm";
import MarathonProjection from "../components/MarathonProjection";
import RaceCountdown from "../components/RaceCountdown";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import WeeklyPlanVsActualChart from "../components/WeeklyPlanVsActualChart";
import ZonesAggregate from "../components/ZonesAggregate";
import TodayWorkoutCard from "../components/TodayWorkoutCard";
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
import {
  PROJECTION_LONG_RUN_MIN_KM,
  ProjectionCard,
  HrZoneBadge,
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
  type HrZone,
} from "./_buenosAiresUtils";

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
        .ba-card { background: linear-gradient(180deg, rgba(255,255,255,.048), rgba(255,255,255,.022)); border: 1px solid rgba(255,255,255,.085); border-radius: 22px; box-shadow: 0 18px 60px rgba(0,0,0,.20); }
        .ba-card-soft { background: rgba(255,255,255,.032); border: 1px solid rgba(255,255,255,.07); border-radius: 18px; }
        .ba-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.34); }
        .ba-value { font-family: 'Bebas Neue', sans-serif; letter-spacing: .035em; color: #fff; line-height: .95; }
        .ba-muted { color: rgba(255,255,255,.50); font-size: 13px; }
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

          <div className="ba-card" style={{ padding: "1.2rem" }}>
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
              <div className="ba-card-soft" style={{ padding: ".95rem" }}>
                <p className="ba-label">Pace-alvo</p>
                <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
                  {targetPaceLabel.replace("/km", "")}
                </p>
                <p className="ba-muted" style={{ fontSize: 12 }}>
                  /km
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: ".95rem" }}>
                <p className="ba-label">Projetado</p>
                <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
                  {formatDurationShort(targetPredictionSeconds)}
                </p>
                <p className="ba-muted" style={{ fontSize: 12 }}>
                  tempo-alvo
                </p>
              </div>
              <div className="ba-card-soft" style={{ padding: ".95rem" }}>
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
          <div className="ba-card-soft" style={{ padding: ".95rem" }}>
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
          <TodayWorkoutCard
            todaySisrunRow={todaySisrunRow}
            todayStravaKm={todayStravaKm}
          />

          <div className="ba-card" style={{ padding: "1.2rem" }}>
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
            <div className="ba-card" style={{ padding: "1.2rem" }}>
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

            <div className="ba-card" style={{ padding: "1.2rem" }}>
              <p className="ba-label">Referência Daniels</p>
              <h2
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
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
          <div className="ba-card" style={{ padding: "1.15rem" }}>
            <p className="ba-label">Projeções</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: 650,
                marginTop: 8,
              }}
            >
              Maratona
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: ".75rem",
                marginTop: ".9rem",
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
            <div
              style={{
                marginTop: ".9rem",
                padding: ".85rem",
                borderRadius: 18,
                background: "rgba(255,255,255,.032)",
                border: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <ManualPredictionForm
                initialValue={manualPredictions.stravaMarathonPrediction}
              />
            </div>
          </div>

          <div className="ba-card" style={{ padding: "1.2rem" }}>
            <p className="ba-label">Longões recentes</p>
            <h2
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              Especificidade
            </h2>
            <div
              style={{ display: "grid", gap: ".65rem", marginTop: ".95rem" }}
            >
              {recentLongRuns.length > 0 ? (
                recentLongRuns.slice(0, 4).map((run) => {
                  const km = run.distance / 1000;
                  const hr = run.average_heartrate;
                  return (
                    <div
                      key={run.id}
                      style={{
                        padding: ".8rem",
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
                          <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>
                            {run.name}
                          </p>
                          <p
                            className="ba-muted"
                            style={{ fontSize: 12, marginTop: 3 }}
                          >
                            {formatDate(run.start_date_local)}
                          </p>
                        </div>
                        <p style={{ color: "#f5a623", fontWeight: 750, fontSize: 13 }}>
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

        {/* Zonas de ritmo agregadas */}
        <section style={{ marginBottom: "1rem" }}>
          <ZonesAggregate />
        </section>

        <section className="ba-card" style={{ padding: "1.2rem" }}>
          <p className="ba-label">Resumo estratégico</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: ".85rem",
              marginTop: ".9rem",
            }}
          >
            <div className="ba-card-soft" style={{ padding: ".95rem" }}>
              <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Momento</p>
              <p
                className="ba-muted"
                style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}
              >
                Ciclo em {cyclePhase.name}, com semáforo{" "}
                {readiness.label.toLowerCase()} e alvo de {targetPaceLabel}.
              </p>
            </div>
            <div className="ba-card-soft" style={{ padding: ".95rem" }}>
              <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Semana</p>
              <p
                className="ba-muted"
                style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}
              >
                {sisrunWeek
                  ? `${currentWeekKm.toFixed(1)} km executados de ${plannedWeekKm.toFixed(1)} km planejados.`
                  : "Sem SisRUN carregado para a semana."}
              </p>
            </div>
            <div className="ba-card-soft" style={{ padding: ".95rem" }}>
              <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Próximo foco</p>
              <p
                className="ba-muted"
                style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}
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

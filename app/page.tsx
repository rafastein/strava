// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import { after } from "next/server";
import { syncCorosIfStale } from "./lib/coros-sync";
import Navbar from "./components/Navbar";
import RevalidateButton from "./components/RevalidateButton";
import TodayWorkoutCard from "./components/TodayWorkoutCard";
import WeekDayBars from "./components/WeekDayBars";
import WeeklyComparisonChart from "./components/WeeklyComparisonChart";
import {
  formatDayMonth,
  formatDuration,
  formatKm,
  formatLongDate,
  formatNumber,
  formatPace,
  formatPaceFromDistance,
  formatWeekdayLong,
  formatWeekdayShort,
} from "./lib/format";
import {
  buildWeekDays,
  daysBetweenDateKeys,
  formatCountdown,
  getPrKeyForRaceDistance,
  type RacePrKey,
} from "./lib/home-week";
import { getAllStructuredPlannedWorkouts, getStructuredPlannedWorkout } from "./lib/planned-workout";
import { getCorosPlannedKmByDate } from "./lib/plan-history";
import {
  buildStructuredWeeklyComparison,
  getStructuredCurrentWeekSummary,
} from "./lib/planned-weekly-comparison";
import {
  getRaceCalendarData,
  getRaceCalendarTodayKey,
  getUpcomingManagedRaces,
} from "./lib/race-calendar";
import { getSeasonEpochRange, getYearFromDateKey } from "./lib/season";
import { getValidStravaAccessToken } from "./lib/strava-auth";
import {
  getStravaActivities,
  getStravaAthlete,
  isRunActivity,
  type StravaActivitySummary,
} from "./lib/strava-client";
import { formatPrTime, getDynamicAthleteProfile } from "./lib/strava-prs";
import { STATUS_META, describeTsb, getCurrentLoad } from "./lib/training-load";
import { getTrainingLoadSnapshot } from "./lib/training-load-snapshot";

// Semanas recentes que a home compara (planejado × executado, atividades recentes).
const RECENT_WINDOW_DAYS = 42;
const RECENT_ACTIVITIES = 5;

const PR_LABELS: Record<RacePrKey, string> = {
  km5: "Seus melhores 5 km",
  km10: "Seus melhores 10 km",
  half: "Sua melhor meia",
  marathon: "Sua melhor maratona",
};

async function getActivities(seasonYear: number): Promise<StravaActivitySummary[]> {
  const season = getSeasonEpochRange(seasonYear);
  // Em janeiro a janela recente começa em dezembro: sem isso a semana da virada
  // e a lista de atividades ficariam vazias.
  const recentStart = Math.floor(Date.now() / 1000) - RECENT_WINDOW_DAYS * 86_400;
  return getStravaActivities({
    after: Math.min(season.after, recentStart),
    before: season.before,
    maxPages: 20,
  });
}

function getLocalDateKey(activity: StravaActivitySummary) {
  return (activity.start_date_local ?? activity.start_date ?? "").slice(0, 10);
}

export default async function Home() {
  const accessToken = await getValidStravaAccessToken();
  const todayKey = getRaceCalendarTodayKey();
  // Agenda do COROS em dia sem atrasar a página: roda depois da resposta, se a última tiver mais de 3 h.
  after(() => syncCorosIfStale(todayKey));
  const seasonYear = getYearFromDateKey(todayKey) ?? new Date().getFullYear();

  const [
    athlete,
    activities,
    athleteProfile,
    structuredWorkoutResult,
    allStructuredPlannedWorkouts,
    raceCalendarData,
    loadSnapshot,
  ] = await Promise.all([
    getStravaAthlete(),
    getActivities(seasonYear),
    accessToken ? getDynamicAthleteProfile(accessToken) : Promise.resolve(null),
    getStructuredPlannedWorkout(),
    getAllStructuredPlannedWorkouts(),
    getRaceCalendarData(),
    // A carga é um resumo: se falhar, a home continua sem essa linha.
    accessToken ? getTrainingLoadSnapshot(accessToken).catch(() => null) : Promise.resolve(null),
  ]);

  // ── Próxima prova ──
  const upcomingRaces = getUpcomingManagedRaces(raceCalendarData.races, todayKey);
  const nextRace = upcomingRaces[0] ?? null;
  const daysToRace = nextRace ? daysBetweenDateKeys(todayKey, nextRace.dateKey) : null;
  const countdown = daysToRace !== null ? formatCountdown(daysToRace) : null;
  const prKey = nextRace ? getPrKeyForRaceDistance(nextRace.distanceKm) : null;
  const pr = prKey ? athleteProfile?.prs[prKey] ?? null : null;

  // ── Semana ──
  const structuredWeek = getStructuredCurrentWeekSummary(allStructuredPlannedWorkouts);
  const plannedWeekKm = structuredWeek.plannedKm;
  const plannedKmByDate = getCorosPlannedKmByDate(allStructuredPlannedWorkouts);

  const weekDays = buildWeekDays(activities, todayKey, raceCalendarData.races.map((race) => race.dateKey), plannedKmByDate);
  const weekKm = weekDays.reduce((sum, day) => sum + day.km, 0);
  const weekRuns = weekDays.reduce((sum, day) => sum + day.runs, 0);
  // Mesma escala para feito e planejado, para as barras serem comparáveis.
  const weekMaxKm = Math.max(...weekDays.map((day) => Math.max(day.km, day.plannedKm)), 1);
  const weekHasPlanByDay = weekDays.some((day) => day.plannedKm > 0);
  const plannedLongRunKm = structuredWeek.longRunPlannedKm;
  const weekKeys = new Set(weekDays.map((day) => day.dateKey));
  const longestRunKm = activities
    .filter((activity) => isRunActivity(activity) && weekKeys.has(getLocalDateKey(activity)))
    .reduce((max, activity) => Math.max(max, activity.distance / 1000), 0);
  const adherencePct = plannedWeekKm > 0 ? Math.min((weekKm / plannedWeekKm) * 100, 100) : 0;

  // ── Treino de hoje ──
  const hasWorkoutToday = Boolean(structuredWorkoutResult.data);
  const todayKm = weekDays.find((day) => day.isToday)?.km ?? 0;

  // ── Carga ──
  const load = loadSnapshot ? getCurrentLoad(loadSnapshot.days) : null;
  const loadMeta = load ? STATUS_META[load.status] : null;

  // ── Temporada ──
  // Os números do ano contam só a temporada; `activities` pode incluir dezembro anterior.
  const runs = activities.filter(isRunActivity);
  const seasonRuns = runs.filter((a) => getYearFromDateKey(getLocalDateKey(a)) === seasonYear);
  const seasonKm = seasonRuns.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const seasonTime = seasonRuns.reduce((sum, a) => sum + a.moving_time, 0);
  const seasonElevation = seasonRuns.reduce((sum, a) => sum + a.total_elevation_gain, 0);
  const hrRuns = seasonRuns.filter((a) => typeof a.average_heartrate === "number" && a.average_heartrate > 0);
  const hrTime = hrRuns.reduce((sum, a) => sum + a.moving_time, 0);
  const avgHeartRate =
    hrTime > 0 ? hrRuns.reduce((sum, a) => sum + (a.average_heartrate ?? 0) * a.moving_time, 0) / hrTime : null;

  const seasonStats = [
    { label: "no ano", value: formatKm(seasonKm, 0) },
    { label: "corridas", value: formatNumber(seasonRuns.length) },
    { label: "pace médio", value: seasonKm > 0 ? formatPace(seasonTime / seasonKm) : "—" },
    { label: "por corrida", value: seasonRuns.length ? formatKm(seasonKm / seasonRuns.length) : "—" },
    { label: "FC média", value: avgHeartRate ? `${formatNumber(avgHeartRate)} bpm` : "—" },
    { label: "de subida", value: `${formatNumber(seasonElevation)} m` },
  ];

  // ── Planejado × executado ──
  const weeklyComparison = buildStructuredWeeklyComparison(allStructuredPlannedWorkouts, activities, 6);
  const hasAnyPlan = weeklyComparison.some((week) => week.plannedKm > 0);

  // ── Atividades recentes ──
  const recentRuns = [...runs]
    .sort((a, b) => getLocalDateKey(b).localeCompare(getLocalDateKey(a)) || b.id - a.id)
    .slice(0, RECENT_ACTIVITIES);

  const firstName = athlete?.firstname ?? "Rafael";

  return (
    <div className="ui-page">
      <Navbar athleteName={athlete?.firstname} athleteAvatar={athlete?.profile_medium ?? undefined} />

      <main className="ui-container">
        <header className="ui-header">
          <div>
            <p className="ui-header__eyebrow">{formatLongDate(todayKey)}</p>
            <h1 className="ui-title">Olá, {firstName}</h1>
          </div>
          <RevalidateButton variant="icon" label="Atualizar dados do Strava" />
        </header>

        <div className="hoje-grid">
          <div className="hoje-col">
            {/* ── Próxima prova ── */}
            {nextRace && countdown ? (
              <section className="ui-card ui-card--pad ui-stack" aria-label="Próxima prova">
                <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
                  <p className="ui-label-accent">Próxima prova</p>
                  {nextRace.badge ? <span className="ui-chip">{nextRace.badge}</span> : null}
                </div>
                <div>
                  <h2 className="hoje-race__title">{nextRace.name}</h2>
                  <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>
                    {formatWeekdayLong(nextRace.dateKey)}, {formatDayMonth(nextRace.dateKey)} · {nextRace.location} ·{" "}
                    {formatKm(nextRace.distanceKm)}
                  </p>
                </div>
                <div className="hoje-race__row">
                  <p className="hoje-race__count">
                    <span className="hoje-race__count-value">{countdown.value}</span>
                    {countdown.unit ? <span className="hoje-race__count-unit">{countdown.unit}</span> : null}
                  </p>
                  {pr && prKey ? (
                    <p className="hoje-race__pr">
                      <span className="ui-muted" style={{ fontSize: 12 }}>{PR_LABELS[prKey]}</span>
                      <span className="hoje-race__pr-value">{formatPrTime(pr.timeSec)}</span>
                      <span className="ui-muted" style={{ fontSize: 12 }}>
                        {pr.name} · {formatDayMonth(pr.startDate)}
                      </span>
                    </p>
                  ) : nextRace.targetPaceSecPerKm ? (
                    <p className="hoje-race__pr">
                      <span className="ui-muted" style={{ fontSize: 12 }}>Pace alvo</span>
                      <span className="hoje-race__pr-value">{formatPace(nextRace.targetPaceSecPerKm)}</span>
                    </p>
                  ) : null}
                </div>
                <Link href="/provas" className="ui-btn">Ver calendário de provas</Link>
              </section>
            ) : (
              <section className="ui-card ui-card--pad ui-stack" aria-label="Próxima prova">
                <p className="ui-label-accent">Próxima prova</p>
                <p style={{ fontSize: 15 }}>Nenhuma prova cadastrada daqui para frente.</p>
                <Link href="/provas" className="ui-btn">Cadastrar prova</Link>
              </section>
            )}

            {/* ── Esta semana ── */}
            <section className="ui-card ui-card--pad ui-stack" aria-label="Esta semana">
              <div className="ui-section__head" style={{ padding: 0 }}>
                <h2 className="ui-h2">Esta semana</h2>
                <span className="ui-muted">
                  {formatDayMonth(weekDays[0].dateKey)} – {formatDayMonth(weekDays[6].dateKey)}
                </span>
              </div>

              <p className="hoje-week__total">
                <span className="hoje-week__km">{formatKm(weekKm)}</span>
                <span className="ui-muted" style={{ fontSize: 14 }}>
                  {weekRuns === 0 ? "nenhuma corrida ainda" : weekRuns === 1 ? "em 1 corrida" : `em ${weekRuns} corridas`}
                </span>
              </p>

              <WeekDayBars days={weekDays} todayKey={todayKey} maxKm={weekMaxKm} showLegend={weekHasPlanByDay} />

              {plannedWeekKm > 0 ? (
                <div className="ui-stack" style={{ gap: 8 }}>
                  <div className="ui-section__head" style={{ padding: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatNumber(adherencePct)}% do plano
                    </span>
                    <span className="ui-muted">
                      {formatKm(plannedWeekKm)} planejados · COROS
                    </span>
                  </div>
                  <div className="hoje-progress" role="img" aria-label={`${formatNumber(adherencePct)}% do volume planejado`}>
                    <div className="hoje-progress__fill" style={{ width: `${adherencePct}%` }} />
                  </div>
                  {plannedLongRunKm > 0 ? (
                    <p className="ui-muted">
                      Longão: {formatKm(longestRunKm)} de {formatKm(plannedLongRunKm)}
                      {longestRunKm >= plannedLongRunKm ? " · cumprido" : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="hoje-notice">
                  <div>
                    <p className="hoje-notice__title">Sem plano nesta semana</p>
                    <p className="ui-muted">Importe do COROS para comparar planejado × executado.</p>
                  </div>
                  <Link href="/coros" className="ui-btn ui-btn--ghost">Importar</Link>
                </div>
              )}
            </section>

            {hasWorkoutToday ? (
              <TodayWorkoutCard
                todayStravaKm={todayKm}
                structuredWorkout={structuredWorkoutResult.data}
                structuredWorkoutSourceLabel={structuredWorkoutResult.sourceLabel}
              />
            ) : null}
          </div>

          <div className="hoje-col">
            {/* ── Carga ── */}
            {load && loadMeta ? (
              <Link href="/carga" className="ui-card hoje-load" aria-label="Carga de treino: ver detalhes">
                <span className="ui-row__main">
                  <span className="ui-muted">Carga de treino</span>
                  <span className="hoje-load__status" style={{ color: loadMeta.color }}>{loadMeta.label}</span>
                  <span className="ui-muted">
                    Aguda/crônica {formatNumber(load.ratio, 2)} · {describeTsb(load.tsb).label.toLowerCase()}
                  </span>
                </span>
                <span className="hoje-load__nums">
                  {[
                    { label: "Forma", value: formatNumber(load.ctl, 1) },
                    { label: "Fadiga", value: formatNumber(load.atl, 1) },
                    { label: "Frescor", value: `${load.tsb > 0 ? "+" : ""}${formatNumber(load.tsb, 1)}` },
                  ].map((item) => (
                    <span key={item.label} className="hoje-load__num">
                      <span className="ui-muted" style={{ fontSize: 12 }}>{item.label}</span>
                      <span className="hoje-load__num-value">{item.value}</span>
                    </span>
                  ))}
                  <svg className="ui-row__chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ) : null}

            {/* ── Temporada ── */}
            <section className="ui-section" aria-label={`Temporada ${seasonYear}`}>
              <div className="ui-section__head">
                <h2 className="ui-h2">Temporada {seasonYear}</h2>
              </div>
              <div className="ui-stat-grid">
                {seasonStats.map((stat) => (
                  <div key={stat.label} className="ui-stat">
                    <span className="ui-stat__value">{stat.value}</span>
                    <span className="ui-stat__label">{stat.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Atividades recentes ── */}
            <section className="ui-section" aria-label="Atividades recentes">
              <div className="ui-section__head">
                <h2 className="ui-h2">Atividades recentes</h2>
              </div>
              {recentRuns.length ? (
                <div className="ui-card ui-list">
                  {recentRuns.map((activity) => {
                    const dateKey = getLocalDateKey(activity);
                    return (
                      <a
                        key={activity.id}
                        href={`https://www.strava.com/activities/${activity.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-row"
                      >
                        <span className="ui-row__main">
                          <span className="ui-row__title">{activity.name}</span>
                          <span className="ui-muted">
                            {formatWeekdayShort(dateKey)}, {formatDayMonth(dateKey)} · {formatDuration(activity.moving_time)}
                          </span>
                        </span>
                        <span className="ui-row__side">
                          <span className="ui-row__value">{formatKm(activity.distance / 1000, 2)}</span>
                          <span className="ui-muted">{formatPaceFromDistance(activity.distance, activity.moving_time)}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="ui-card ui-card--pad ui-muted">Nenhuma corrida encontrada no Strava.</p>
              )}
            </section>
          </div>
        </div>

        {/* ── Planejado × executado (só quando existe plano) ── */}
        {hasAnyPlan ? (
          <section className="ui-section" style={{ marginTop: 12 }}>
            <WeeklyComparisonChart
              items={weeklyComparison}
              title="Planejado × executado por semana"
              subtitle="Volume planejado no COROS comparado com o executado no Strava."
              orderLabel="Da semana atual para as próximas"
              dark
            />
          </section>
        ) : null}
      </main>

      <footer className="ui-footer">Strava × COROS · {firstName} Cabral · {seasonYear}</footer>
    </div>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "./components/Navbar";
import ActivitiesPanel from "./components/ActivitiesPanel";
import WeeklyComparisonChart from "./components/WeeklyComparisonChart";
import NextRaceCard from "./components/NextRaceCard";
import SeasonCalendar from "./SeasonCalendar";
import RaceCountdown from "./components/RaceCountdown";
import TodayWorkoutCard from "./components/TodayWorkoutCard";
import {
  buildWeeklyComparison,
  getCurrentWeek,
  getCurrentWeekLongestRunKm,
  getCurrentWeekStravaKm,
  getSisrunData,
  getTodaySisrunRow,
  getTodayStravaKm,
  type SisrunWeek,
} from "./lib/sisrun-utils";
import { getValidStravaAccessToken } from "./lib/strava-auth";
import { BUENOS_AIRES_RACE_ISO, DASHBOARD_RACES } from "./lib/race-calendar";
import {
  getStravaActivities,
  getStravaAthlete,
  isRunActivity,
  type StravaActivitySummary,
  type StravaAthlete,
} from "./lib/strava-client";
import { getDynamicAthleteProfile } from "./lib/strava-prs";
import {
  formatEfficiency,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
} from "./lib/strava-long-runs";
import { getStructuredPlannedWorkout } from "./lib/planned-workout";

type StravaActivity = StravaActivitySummary;
type Athlete = StravaAthlete;

const YEAR_SUMMARY = 2026;
const YEAR_START_EPOCH = Math.floor(new Date(`${YEAR_SUMMARY}-01-01T00:00:00Z`).getTime() / 1000);
const YEAR_END_EPOCH   = Math.floor(new Date(`${YEAR_SUMMARY + 1}-01-01T00:00:00Z`).getTime() / 1000);

async function getActivities(): Promise<StravaActivity[]> {
  return getStravaActivities({
    after: YEAR_START_EPOCH,
    before: YEAR_END_EPOCH,
    maxPages: 20,
  });
}

async function getAthlete(): Promise<Athlete | null> {
  return getStravaAthlete();
}

function formatPace(distance: number, time: number) {
  if (!distance || !time) return "-";
  const pace = time / (distance / 1000);
  const min = Math.floor(pace / 60);
  const sec = Math.round(pace % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function buildAlerts(params: {
  hasSisrunWeek: boolean;
  plannedWeekKm: number;
  currentWeekKm: number;
  adherencePct: number;
  longRunPlannedKm: number;
  longRunDoneKm: number;
}) {
  const alerts: { title: string; text: string; ok: boolean }[] = [];
  if (!params.hasSisrunWeek) {
    alerts.push({ title: "SisRUN ausente", text: "Carregue uma planilha para comparar planejamento e execução.", ok: false });
    return alerts;
  }
  if (params.adherencePct < 70) {
    alerts.push({ title: "Semana abaixo da meta", text: "O volume executado ainda está bem abaixo do planejado.", ok: false });
  } else if (params.adherencePct < 90) {
    alerts.push({ title: "Semana em construção", text: "Você está no caminho, mas ainda falta volume.", ok: false });
  } else {
    alerts.push({ title: "Boa aderência semanal ✓", text: "A execução está acompanhando bem o volume planejado.", ok: true });
  }
  if (params.longRunPlannedKm > 0) {
    const done = params.longRunDoneKm >= params.longRunPlannedKm;
    alerts.push({
      title: done ? "Longão cumprido ✓" : "Longão não cumprido",
      text: `${params.longRunDoneKm.toFixed(1)} km feitos · previsto ${params.longRunPlannedKm.toFixed(1)} km`,
      ok: done,
    });
  }
  return alerts;
}

export default async function Home() {
  const accessToken = await getValidStravaAccessToken();
  const [athlete, activities, sisrunData, athleteProfile, structuredWorkoutResult] = await Promise.all([
    getAthlete(),
    getActivities(),
    getSisrunData(),
    accessToken ? getDynamicAthleteProfile(accessToken) : Promise.resolve(null),
    getStructuredPlannedWorkout(),
  ]);

  const sisrunWeek = getCurrentWeek(sisrunData) as SisrunWeek | null;
  const todaySisrunRow = getTodaySisrunRow(sisrunData);
  const runs = activities.filter(isRunActivity);
  const totalKm = runs.reduce((acc, a) => acc + a.distance, 0) / 1000;
  const totalTime = runs.reduce((acc, a) => acc + a.moving_time, 0);
  const totalElevation = runs.reduce((acc, a) => acc + a.total_elevation_gain, 0);
  const pace = formatPace(totalKm * 1000, totalTime);
  const avgDistanceKm = runs.length > 0 ? totalKm / runs.length : 0;
  const heartRateRuns = runs.filter(
    (a) => typeof a.average_heartrate === "number" && a.average_heartrate > 0
  );
  const heartRateWeightedTime = heartRateRuns.reduce((acc, a) => acc + a.moving_time, 0);
  const avgHeartRate =
    heartRateWeightedTime > 0
      ? heartRateRuns.reduce(
          (acc, a) => acc + (a.average_heartrate ?? 0) * a.moving_time,
          0
        ) / heartRateWeightedTime
      : null;
  const currentWeekKm = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm = getTodayStravaKm(activities);
  const plannedWeekKm = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct = plannedWeekKm > 0 ? Math.min((currentWeekKm / plannedWeekKm) * 100, 100) : 0;
  const weeklyComparison = buildWeeklyComparison(sisrunData, activities, 6);
  const longRuns = await getLongRunsFromActivities(activities);
  const longRunSummary = getLongRunSummary(longRuns);

  const alerts = buildAlerts({
    hasSisrunWeek: Boolean(sisrunWeek),
    plannedWeekKm,
    currentWeekKm,
    adherencePct: weeklyAdherencePct,
    longRunPlannedKm: sisrunWeek?.longRunPlannedKm ?? 0,
    longRunDoneKm: currentWeekLongestRunKm,
  });

  return (
    <div className="page">
      {/* ── NAV ── */}
      <Navbar athleteName={athlete?.firstname} athleteAvatar={athlete?.profile_medium ?? undefined} />

      {/* ── HERO ── */}
      <section className="home-hero">
        <div className="home-hero__glow-1" />
        <div className="home-hero__glow-2" />
        <div className="home-hero__inner">
          <div>
            <p className="ba-eyebrow" style={{ marginBottom: "1rem" }}>
              Temporada 2026 · Buenos Aires 20/09
            </p>
            <h1 className="home-hero__title">
              {athlete?.firstname ?? "Atleta"}<br />
              <span className="home-hero__title-accent">Cabral</span>
            </h1>
            <p className="home-hero__sub">
              Dashboard de treinos, projeções e análise de corrida. Powered by Strava + COROS/Upstash + SisRUN.
            </p>
            <div className="home-hero__actions">
              <Link href="/buenos-aires" className="ba-cta">Modo maratona →</Link>
              <Link href="/sisrun" className="ba-cta-ghost">SisRUN</Link>
            </div>
          </div>

          {/* Countdown + Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="home-hero__countdown">
              <p className="ba-eyebrow" style={{ marginBottom: "0.75rem", fontSize: 10 }}>
                Buenos Aires — 20 set 2026
              </p>
              <RaceCountdown targetDate={BUENOS_AIRES_RACE_ISO} raceName="Buenos Aires" />
            </div>

            <div className="home-hero__stats-grid">
              {[
                { label: "km em 2026", value: totalKm.toFixed(0) },
                { label: "corridas", value: String(runs.length) },
                { label: "distância média", value: `${avgDistanceKm.toFixed(1)} km` },
                { label: "pace médio", value: pace },
                { label: "fc média", value: avgHeartRate ? `${avgHeartRate.toFixed(0)} bpm` : "—" },
                { label: "elevação", value: `${totalElevation.toFixed(0)} Metros` },
              ].map((s) => (
                <div key={s.label} className="home-stat-card">
                  <p className="ba-label" style={{ marginBottom: 4 }}>{s.label}</p>
                  <p className="ba-value home-stat-card__value">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="home-content">

        <SeasonCalendar activities={activities} prs={athleteProfile?.prs ?? null} />

        {/* ── SEMANA ATUAL ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Esta semana</p>
          <div className="ba-grid-4">
            {[
              { label: "Planejado (SisRUN)", value: sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "—", accent: false },
              { label: "Executado (Strava)", value: `${currentWeekKm.toFixed(1)} km`, accent: true },
              { label: "Aderência", value: sisrunWeek ? `${weeklyAdherencePct.toFixed(0)}%` : "—", accent: weeklyAdherencePct >= 90 },
              {
                label: "Longão",
                value: sisrunWeek
                  ? `${currentWeekLongestRunKm.toFixed(1)} / ${(sisrunWeek.longRunPlannedKm ?? 0).toFixed(1)} km`
                  : `${currentWeekLongestRunKm.toFixed(1)} km`,
                accent: false,
              },
            ].map((c) => (
              <MetricCard key={c.label} label={c.label} value={c.value} accent={c.accent} />
            ))}
          </div>
        </section>

        {/* ── HOJE + ALERTAS ── */}
        <section className="home-today-section">
          <TodayWorkoutCard
            todaySisrunRow={todaySisrunRow}
            todayStravaKm={todayStravaKm}
            structuredWorkout={structuredWorkoutResult.data}
            structuredWorkoutSourceLabel={structuredWorkoutResult.sourceLabel}
          />

          <div className="ba-grid-2">
            {alerts.map((a, i) => (
              <div key={i} className="ba-card" style={{ padding: "1.25rem 1.5rem", background: a.ok ? "rgba(16,185,129,0.06)" : "rgba(245,166,35,0.06)", border: `1px solid ${a.ok ? "rgba(16,185,129,0.15)" : "rgba(245,166,35,0.15)"}` }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: a.ok ? "#10b981" : "#f5a623", marginBottom: 4 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRÓXIMA PROVA ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Calendário de provas</p>
          <NextRaceCard races={DASHBOARD_RACES} dark />
        </section>

        {/* ── LONGÕES ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Longões</p>
          <div className="ba-grid-4">
            {[
              { label: "Total de longões", value: String(longRunSummary.totalLongRuns) },
              { label: "Pace médio", value: formatLongRunPace(longRunSummary.averagePaceSecPerKm) },
              { label: "Melhor eficiência", value: formatEfficiency(longRunSummary.bestEfficiency) },
            ].map((c) => (
              <MetricCard key={c.label} label={c.label} value={c.value} accent={false} />
            ))}
            <Link href="/longoes" className="ba-card" style={{ padding: "1.5rem", textDecoration: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.2)" }}>
              <p className="ba-eyebrow">Análise completa</p>
              <p className="ba-value" style={{ fontSize: 22, marginTop: 8 }}>Ver longões →</p>
            </Link>
          </div>
        </section>

        {/* ── GRÁFICO SEMANAL ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Planejado × executado</p>
          <WeeklyComparisonChart
            items={weeklyComparison}
            title="Planejado x executado por semana"
            subtitle="Volume planejado no SisRUN comparado com o executado no Strava."
            dark
          />
        </section>

        {/* ── NAVEGAÇÃO ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Explorar</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { href: "/treinos-qualidade", label: "Treinos de qualidade", desc: "Intervalados, fartleks e progressivos.", tag: "Treinos" },
              { href: "/meias", label: "Meias maratonas", desc: "Splits sobrepostos, prova a prova.", tag: "Análise" },
              { href: "/corridas-brasil", label: "Corridas pelo Brasil", desc: "Mapa com corridas por estado.", tag: "Mapas" },
              { href: "/corridas-mundo", label: "Corridas pelo mundo", desc: "Mapa-múndi com corridas por país.", tag: "Mapas" },
              { href: "/equipamentos", label: "Equipamentos", desc: "Km, desgaste e eficiência por tênis.", tag: "Strava" },
              { href: "/sisrun", label: "SisRUN", desc: "Planejamento e aderência semanal.", tag: "Planejamento" },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="ba-card-soft explore-card" style={{ padding: ".85rem 1rem", textDecoration: "none", display: "block" }}>
                <p className="ba-eyebrow" style={{ marginBottom: "0.6rem", fontSize: 9 }}>{c.tag}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: "0.35rem" }}>{c.label}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{c.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── ATIVIDADES ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <p className="ba-label" style={{ marginBottom: "0.75rem" }}>Atividades recentes</p>
          <div className="ba-card" style={{ overflow: "hidden", padding: 0 }}>
            <ActivitiesPanel activities={activities} dark />
          </div>
        </section>

      </div>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        STRAVA × SISRUN · {athlete?.firstname ?? "RAFAEL"} CABRAL · 2026
      </footer>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: boolean }) {
  return (
    <div className="ba-card" style={{ padding: "1rem 1.25rem", borderColor: accent ? "rgba(245,166,35,0.25)" : undefined }}>
      <p className="ba-label" style={{ marginBottom: 6 }}>{label}</p>
      <p className="ba-value" style={{ fontSize: 24, color: accent ? "var(--accent)" : undefined }}>{value}</p>
    </div>
  );
}
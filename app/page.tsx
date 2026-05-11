export const dynamic = "force-dynamic";

import Link from "next/link";
import { formatBRDate } from "./lib/date-utils";
import ActivitiesPanel from "./components/ActivitiesPanel";
import WeeklyComparisonChart from "./components/WeeklyComparisonChart";
import NextRaceCard from "./components/NextRaceCard";
import RaceCountdown from "./components/RaceCountdown";
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
import {
  formatEfficiency,
  formatLongRunPace,
  getLongRunSummary,
  getLongRunsFromActivities,
} from "./lib/strava-long-runs";

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
  location_city?: string | null;
  location_state?: string | null;
};

type Athlete = {
  id: number;
  firstname: string;
  lastname: string;
  city: string | null;
  state: string | null;
  profile_medium: string | null;
};

const YEAR_SUMMARY = 2026;
const YEAR_START_EPOCH = Math.floor(new Date(`${YEAR_SUMMARY}-01-01T00:00:00Z`).getTime() / 1000);
const YEAR_END_EPOCH   = Math.floor(new Date(`${YEAR_SUMMARY + 1}-01-01T00:00:00Z`).getTime() / 1000);

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];
    const all: StravaActivity[] = [];
    for (let page = 1; page <= 20; page++) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.searchParams.set("per_page", "200");
      url.searchParams.set("page", String(page));
      url.searchParams.set("after", String(YEAR_START_EPOCH));
      url.searchParams.set("before", String(YEAR_END_EPOCH));
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!res.ok) break;
      const batch = (await res.json()) as StravaActivity[];
      if (!Array.isArray(batch) || !batch.length) break;
      all.push(...batch);
      if (batch.length < 200) break;
    }
    return all;
  } catch { return []; }
}

async function getAthlete(): Promise<Athlete | null> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return null;
    const res = await fetch("https://www.strava.com/api/v3/athlete", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
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

const RACES = [
  { name: "Circuito Serrano", date: "2026-05-16T07:00:00-03:00", location: "Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Meia Maratona de Lima", date: "2026-05-24T07:00:00-05:00", location: "Lima, Peru", distanceKm: 21.1, objective: "Pace de maratona (5:20/km)", targetPaceSecPerKm: 320 },
  { name: "Maratona do Rio", date: "2026-06-06T07:00:00-03:00", location: "Rio de Janeiro, Brasil", distanceKm: 21.1, objective: "All-in — sub-1:45", targetPaceSecPerKm: 298 },
  { name: "Maratona Intl Praia Grande (10km)", date: "2026-06-20T07:00:00-03:00", location: "Praia Grande, Brasil", distanceKm: 10.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Maratona Intl Praia Grande (5km)", date: "2026-06-21T07:00:00-03:00", location: "Praia Grande, Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Cats Run", date: "2026-07-12T07:00:00-03:00", location: "Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Asics Run Challenge", date: "2026-07-26T07:00:00-03:00", location: "Brasil", distanceKm: 15.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Meia da Chapada", date: "2026-08-01T07:00:00-03:00", location: "Chapada dos Veadeiros, Brasil", distanceKm: 21.1, objective: "Simulado/treino", targetPaceSecPerKm: null },
  { name: "Meia Maratona da Polícia Federal", date: "2026-08-09T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 21.1, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Track & Field Run Series Conjunto", date: "2026-08-16T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 15.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Quatro Poderes Run", date: "2026-08-22T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 10.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Run The Bridge", date: "2026-08-30T07:00:00-03:00", location: "Brasil", distanceKm: 30.0, objective: "Simulado 30km (5:20/km)", targetPaceSecPerKm: 320 },
  { name: "Maratona de Buenos Aires", date: "2026-09-20T06:00:00-03:00", location: "Buenos Aires, Argentina", distanceKm: 42.0, objective: "Sub-3:45 (5:20/km)", targetPaceSecPerKm: 320, href: "/buenos-aires" },
];

const NAV_LINKS = [
  { href: "/buenos-aires", label: "Buenos Aires" },
  { href: "/longoes", label: "Longões" },
  { href: "/treinos-qualidade", label: "Qualidade" },
  { href: "/meias", label: "Meias" },
  { href: "/corridas-brasil", label: "Brasil" },
  { href: "/corridas-mundo", label: "Mundo" },
  { href: "/equipamentos", label: "Tênis" },
  { href: "/sisrun", label: "SisRUN" },
];

export default async function Home() {
  const [athlete, activities, sisrunData] = await Promise.all([
    getAthlete(),
    getActivities(),
    getSisrunData(),
  ]);

  const sisrunWeek = getCurrentWeek(sisrunData) as SisrunWeek | null;
  const todaySisrunRow = getTodaySisrunRow(sisrunData);
  const runs = activities.filter((a) => a.type === "Run");
  const totalKm = runs.reduce((acc, a) => acc + a.distance, 0) / 1000;
  const totalTime = runs.reduce((acc, a) => acc + a.moving_time, 0);
  const totalElevation = runs.reduce((acc, a) => acc + a.total_elevation_gain, 0);
  const pace = formatPace(totalKm * 1000, totalTime);
  const longest = runs.length > 0 ? runs.reduce((max, a) => (a.distance > max.distance ? a : max)) : null;
  const currentWeekKm = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm = getTodayStravaKm(activities);
  const plannedWeekKm = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct = plannedWeekKm > 0 ? Math.min((currentWeekKm / plannedWeekKm) * 100, 100) : 0;
  const weeklyComparison = buildWeeklyComparison(sisrunData, activities, 6);
  const longRuns = await getLongRunsFromActivities(activities);
  const longRunSummary = getLongRunSummary(longRuns);

  const todayStatus = !todaySisrunRow ? "Sem treino" : todaySisrunRow.plannedDistanceKm === 0 ? "Descanso" : todayStravaKm <= 0 ? "Pendente" : todayStravaKm >= todaySisrunRow.plannedDistanceKm ? "Concluído ✓" : "Parcial";
  const todayOk = todayStatus === "Concluído ✓" || todayStatus === "Descanso";

  const alerts = buildAlerts({
    hasSisrunWeek: Boolean(sisrunWeek),
    plannedWeekKm,
    currentWeekKm,
    adherencePct: weeklyAdherencePct,
    longRunPlannedKm: sisrunWeek?.longRunPlannedKm ?? 0,
    longRunDoneKm: currentWeekLongestRunKm,
  });

  return (
    <main className="min-h-screen" style={{ background: "#0d0d0d", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        .nav-link:hover { color: #fff !important; }
        .explore-card:hover { border-color: rgba(245,166,35,0.3) !important; background: rgba(245,166,35,0.04) !important; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(13,13,13,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {athlete?.profile_medium && (
              <img src={athlete.profile_medium} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.15)" }} />
            )}
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.08em", color: "#fff" }}>
              {athlete?.firstname ?? "ATLETA"}
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5a623", display: "inline-block", marginLeft: 2 }} />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", padding: "6px 10px", borderRadius: 6, textDecoration: "none", transition: "color 0.2s" }}

              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: "relative", overflow: "hidden", padding: "3rem 1.5rem 2.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -150, left: -50, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,69,74,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#f5a623", marginBottom: "1rem" }}>
              Temporada 2026 · Buenos Aires 20/09
            </p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.8rem, 6vw, 5rem)", lineHeight: 0.9, letterSpacing: "0.02em", color: "#fff", marginBottom: "1rem" }}>
              {athlete?.firstname ?? "Atleta"}<br />
              <span style={{ color: "#f5a623" }}>Cabral</span>
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 380, marginBottom: "1.25rem" }}>
              Dashboard de treinos, projeções e análise de corrida. Powered by Strava + SisRUN.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/buenos-aires" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f5a623", color: "#000", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", letterSpacing: "0.02em" }}>
                Modo maratona →
              </Link>
              <Link href="/sisrun" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", padding: "12px 24px", borderRadius: 10, fontWeight: 500, fontSize: 14, textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)" }}>
                SisRUN
              </Link>
            </div>
          </div>

          {/* Countdown + Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 14, padding: "1rem 1.25rem" }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f5a623", marginBottom: "0.75rem" }}>
                Buenos Aires — 20 set 2026
              </p>
              <RaceCountdown targetDate="2026-09-20T06:00:00-03:00" raceName="Buenos Aires" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "km em 2026", value: totalKm.toFixed(0) },
                { label: "corridas", value: String(runs.length) },
                { label: "pace médio", value: pace },
                { label: "elevação", value: `${(totalElevation / 1000).toFixed(1)}k m` },
              ].map((s) => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "0.04em", color: "#fff", lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.75rem 1.5rem" }}>

        {/* ── SEMANA ATUAL ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Esta semana</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Planejado (SisRUN)", value: sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "—", accent: false },
              { label: "Executado (Strava)", value: `${currentWeekKm.toFixed(1)} km`, accent: true },
              { label: "Aderência", value: sisrunWeek ? `${weeklyAdherencePct.toFixed(0)}%` : "—", accent: weeklyAdherencePct >= 90 },
              { label: "Longão", value: sisrunWeek ? `${currentWeekLongestRunKm.toFixed(1)} / ${(sisrunWeek.longRunPlannedKm ?? 0).toFixed(1)} km` : `${currentWeekLongestRunKm.toFixed(1)} km`, accent: false },
            ].map((c) => (
              <MetricCard key={c.label} label={c.label} value={c.value} accent={c.accent} />
            ))}
          </div>
        </section>

        {/* ── HOJE + ALERTAS ── */}
        <section style={{ marginBottom: "1.75rem", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "1.5rem" }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: "0.75rem" }}>Hoje</p>
            {todaySisrunRow ? (
              <>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Planejado: {todaySisrunRow.plannedDistanceKm.toFixed(1)} km</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Strava: {todayStravaKm.toFixed(1)} km</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Nenhum treino previsto.</p>
            )}
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: todayOk ? "rgba(16,185,129,0.15)" : "rgba(245,166,35,0.15)", color: todayOk ? "#10b981" : "#f5a623", border: `1px solid ${todayOk ? "rgba(16,185,129,0.3)" : "rgba(245,166,35,0.3)"}` }}>
              {todayStatus}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ background: a.ok ? "rgba(16,185,129,0.06)" : "rgba(245,166,35,0.06)", border: `1px solid ${a.ok ? "rgba(16,185,129,0.15)" : "rgba(245,166,35,0.15)"}`, borderRadius: 16, padding: "1.25rem 1.5rem" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: a.ok ? "#10b981" : "#f5a623", marginBottom: 4 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRÓXIMA PROVA ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Calendário de provas</SectionLabel>
          <NextRaceCard races={RACES} dark />
        </section>

        {/* ── LONGÕES ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Longões</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) 1.2fr", gap: 12 }}>
            {[
              { label: "Total de longões", value: String(longRunSummary.totalLongRuns) },
              { label: "Pace médio", value: formatLongRunPace(longRunSummary.averagePaceSecPerKm) },
              { label: "Melhor eficiência", value: formatEfficiency(longRunSummary.bestEfficiency) },
            ].map((c) => (
              <MetricCard key={c.label} label={c.label} value={c.value} accent={false} />
            ))}
            <Link href="/longoes" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 16, padding: "1.5rem", textDecoration: "none", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f5a623" }}>Análise completa</p>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.04em", color: "#fff", marginTop: 8 }}>Ver longões →</p>
            </Link>
          </div>
        </section>

        {/* ── GRÁFICO SEMANAL ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Planejado × executado</SectionLabel>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <WeeklyComparisonChart
              items={weeklyComparison}
              title="Planejado x executado por semana"
              subtitle="Volume planejado no SisRUN comparado com o executado no Strava."
            />
          </div>
        </section>

        {/* ── NAVEGAÇÃO ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Explorar</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { href: "/treinos-qualidade", label: "Treinos de qualidade", desc: "Intervalados, fartleks e progressivos detectados automaticamente.", tag: "Treinos" },
              { href: "/meias", label: "Meias maratonas", desc: "Splits km a km sobrepostos — compare evolução prova a prova.", tag: "Análise" },
              { href: "/corridas-brasil", label: "Corridas pelo Brasil", desc: "Mapa do Brasil com corridas por estado.", tag: "Mapas" },
              { href: "/corridas-mundo", label: "Corridas pelo mundo", desc: "Mapa-múndi com corridas por país.", tag: "Mapas" },
              { href: "/equipamentos", label: "Equipamentos", desc: "Km, desgaste e eficiência por tênis.", tag: "Strava" },
              { href: "/sisrun", label: "SisRUN", desc: "Atualize o planejamento e acompanhe aderência semanal.", tag: "Planejamento" },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="explore-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1.1rem 1.25rem", textDecoration: "none", transition: "border-color 0.2s, background 0.2s", display: "block" }}

              >
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f5a623", marginBottom: "0.6rem" }}>{c.tag}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: "0.35rem" }}>{c.label}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{c.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── ATIVIDADES ── */}
        <section style={{ marginBottom: "1.75rem" }}>
          <SectionLabel>Atividades recentes</SectionLabel>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <ActivitiesPanel activities={activities} />
          </div>
        </section>

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
          STRAVA × SISRUN · {athlete?.firstname ?? "RAFAEL"} CABRAL · 2026
        </p>
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "0.75rem" }}>
      {children}
    </p>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: boolean }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent ? "rgba(245,166,35,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "1rem 1.25rem" }}>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.04em", color: accent ? "#f5a623" : "#fff", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

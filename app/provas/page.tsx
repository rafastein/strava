export const dynamic = "force-dynamic";

import Navbar from "../components/Navbar";
import RaceManagerClient from "./RaceManagerClient";
import {
  getRaceCalendarData,
  getRaceCalendarTodayKey,
  getUpcomingManagedRaces,
} from "../lib/race-calendar";

export default async function ProvasPage() {
  const calendar = await getRaceCalendarData();
  const todayKey = getRaceCalendarTodayKey();
  const upcomingRaces = getUpcomingManagedRaces(calendar.races, todayKey);

  return (
    <main className="site-shell">
      <Navbar />
      <div className="ba-page">
        <section className="ba-hero provas-hero">
          <div className="provas-hero__copy">
            <p className="ba-eyebrow">Calendário dinâmico</p>
            <h1 className="ba-title">Provas</h1>
            <p className="ba-subtitle" style={{ maxWidth: 760 }}>
              Cadastro central das próximas provas. As provas passadas permanecem salvas no calendário, mas não aparecem nesta página.
            </p>
          </div>
          <div className="ba-card provas-source-card">
            <p className="ba-label">Fonte atual</p>
            <p style={{ color: "#fff", fontWeight: 800, marginTop: 4 }}>
              {calendar.source === "upstash" ? "Upstash" : "Fallback local"}
            </p>
            <p className="ba-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {upcomingRaces.length} provas futuras · Redis {calendar.redisConfigured ? "configurado" : "ausente"}
            </p>
          </div>
        </section>

        <RaceManagerClient initialRaces={upcomingRaces} todayKey={todayKey} />
      </div>
    </main>
  );
}

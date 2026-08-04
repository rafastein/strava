export const dynamic = "force-dynamic";

import Navbar from "../components/Navbar";
import RaceManagerClient from "./RaceManagerClient";
import { getRaceCalendarData } from "../lib/race-calendar";

export default async function ProvasPage() {
  const calendar = await getRaceCalendarData();

  return (
    <main className="site-shell">
      <Navbar />
      <div className="ba-page">
        <section className="ba-hero provas-hero">
          <div className="provas-hero__copy">
            <p className="ba-eyebrow">Calendário dinâmico</p>
            <h1 className="ba-title">Provas</h1>
            <p className="ba-subtitle" style={{ maxWidth: 760 }}>
              Cadastro central das provas previstas. O Upstash passa a ser a fonte principal; o calendário hardcoded fica apenas como fallback quando não houver nada salvo.
            </p>
          </div>
          <div className="ba-card provas-source-card">
            <p className="ba-label">Fonte atual</p>
            <p style={{ color: "#fff", fontWeight: 800, marginTop: 4 }}>
              {calendar.source === "upstash" ? "Upstash" : "Fallback local"}
            </p>
            <p className="ba-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {calendar.races.length} provas · Redis {calendar.redisConfigured ? "configurado" : "ausente"}
            </p>
          </div>
        </section>

        <RaceManagerClient initialRaces={calendar.races} />
      </div>
    </main>
  );
}

// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import Navbar from "../components/Navbar";
import SeasonCalendar from "../SeasonCalendar";
import { getSeasonEpochRange } from "../lib/season";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { getStravaActivities } from "../lib/strava-client";
import { getDynamicAthleteProfile } from "../lib/strava-prs";
import RaceManagerClient from "./RaceManagerClient";
import {
  getRaceCalendarData,
  getRaceCalendarTodayKey,
  getUpcomingManagedRaces,
} from "../lib/race-calendar";

export default async function ProvasPage() {
  const calendar = await getRaceCalendarData();
  const todayKey = getRaceCalendarTodayKey();
  // Resultados da temporada: as corridas do ano casam com as provas pela data.
  const accessToken = await getValidStravaAccessToken();
  const [seasonActivities, athleteProfile] = await Promise.all([
    getStravaActivities({ ...getSeasonEpochRange(calendar.seasonYear), maxPages: 20 }),
    accessToken ? getDynamicAthleteProfile(accessToken) : Promise.resolve(null),
  ]);
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

        <nav aria-label="Páginas de provas" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 1.25rem" }}>
          <Link href="/meias" className="ui-btn ui-btn--ghost">Meias maratonas</Link>
          <Link href="/buenos-aires" className="ui-btn ui-btn--ghost">Buenos Aires · histórico</Link>
        </nav>

        <RaceManagerClient initialRaces={upcomingRaces} todayKey={todayKey} />

        <div style={{ marginTop: "1.75rem" }}>
          <SeasonCalendar
            activities={seasonActivities}
            prs={athleteProfile?.prs ?? null}
            seasonMonths={calendar.seasonMonths}
            seasonYear={calendar.seasonYear}
          />
        </div>
      </div>
    </main>
  );
}

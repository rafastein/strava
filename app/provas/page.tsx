// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import Navbar from "../components/Navbar";
import RaceManagerClient from "./RaceManagerClient";
import { formatDayMonth, formatDuration, formatKm, formatPace, formatWeekdayLong } from "../lib/format";
import { daysBetweenDateKeys, formatCountdown } from "../lib/home-week";
import {
  getRaceCalendarData,
  getRaceCalendarTodayKey,
  getUpcomingManagedRaces,
  type ManagedRace,
} from "../lib/race-calendar";
import { getSeasonEpochRange, getYearFromDateKey } from "../lib/season";
import { getResultSeasons, resolveSeasonResults } from "../lib/season-results";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { getStravaActivities } from "../lib/strava-client";
import { getDynamicAthleteProfile } from "../lib/strava-prs";

export const metadata = { title: "Provas · Rafael Cabral" };

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function DateBlock({ dateKey }: { dateKey: string }) {
  const [day, month] = formatDayMonth(dateKey).split(" ");
  return (
    <span className="ui-date">
      <span className="ui-date__day">{day}</span>
      <span className="ui-muted" style={{ fontSize: 12 }}>{month}</span>
    </span>
  );
}

function raceDetail(race: ManagedRace, showYear: boolean) {
  return [showYear ? String(getYearFromDateKey(race.dateKey)) : null, formatKm(race.distanceKm), race.badge]
    .filter(Boolean)
    .join(" · ");
}

export default async function ProvasPage({ searchParams }: PageProps) {
  const calendar = await getRaceCalendarData();
  const todayKey = getRaceCalendarTodayKey();
  const currentYear = calendar.seasonYear;

  // Temporada dos resultados: ?temporada=2025; fora da lista, vale a atual.
  const seasons = getResultSeasons(calendar.races, currentYear);
  const requested = Number((await searchParams).temporada);
  const season = seasons.includes(requested) ? requested : currentYear;

  const accessToken = await getValidStravaAccessToken();
  const [seasonActivities, athleteProfile] = await Promise.all([
    getStravaActivities({ ...getSeasonEpochRange(season), maxPages: 20 }),
    accessToken ? getDynamicAthleteProfile(accessToken) : Promise.resolve(null),
  ]);

  const upcomingRaces = getUpcomingManagedRaces(calendar.races, todayKey);
  const [nextRace, ...laterRaces] = upcomingRaces;
  const daysToRace = nextRace ? daysBetweenDateKeys(todayKey, nextRace.dateKey) : null;
  const countdown = daysToRace !== null ? formatCountdown(daysToRace) : null;

  const results = resolveSeasonResults(calendar.races, seasonActivities, athleteProfile?.prs ?? null, todayKey, season);
  const prCount = results.filter((result) => result.isPR).length;

  return (
    <div className="ui-page">
      <Navbar />

      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <h1 className="ui-title">Provas</h1>
        </header>

        <div className="hoje-col">
          {/* ── Próxima ── */}
          {nextRace && countdown ? (
            <section className="ui-card ui-card--pad ui-stack" aria-label="Próxima prova">
              <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
                <p className="ui-label-accent">
                  Próxima · {countdown.unit ? `em ${countdown.value} ${countdown.unit}` : "é hoje"}
                </p>
                {nextRace.badge ? <span className="ui-chip">{nextRace.badge}</span> : null}
              </div>
              <div>
                <h2 className="hoje-race__title" style={{ fontSize: 26 }}>{nextRace.name}</h2>
                <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>
                  {formatWeekdayLong(nextRace.dateKey)}, {formatDayMonth(nextRace.dateKey)} · {nextRace.location} ·{" "}
                  {formatKm(nextRace.distanceKm)}
                </p>
              </div>
              {nextRace.objective || nextRace.targetPaceSecPerKm ? (
                <dl className="ui-dl" style={{ paddingTop: 16, borderTop: "1px solid var(--ui-border)" }}>
                  {nextRace.objective ? (
                    <div>
                      <dt>Objetivo</dt>
                      <dd>{nextRace.objective}</dd>
                    </div>
                  ) : null}
                  {nextRace.targetPaceSecPerKm ? (
                    <div>
                      <dt>Pace alvo</dt>
                      <dd>{formatPace(nextRace.targetPaceSecPerKm)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </section>
          ) : (
            <section className="ui-card ui-card--pad ui-stack" aria-label="Próxima prova">
              <p className="ui-label-accent">Próxima prova</p>
              <p style={{ fontSize: 15 }}>Nenhuma prova cadastrada daqui para frente.</p>
            </section>
          )}

          {/* ── Em seguida ── */}
          {laterRaces.length ? (
            <section className="ui-section" aria-label="Em seguida">
              <div className="ui-section__head">
                <h2 className="ui-h2">Em seguida</h2>
              </div>
              <div className="ui-card ui-list">
                {laterRaces.map((race) => {
                  const days = daysBetweenDateKeys(todayKey, race.dateKey);
                  return (
                    <div key={race.id} className="ui-row ui-row--date">
                      <DateBlock dateKey={race.dateKey} />
                      <span className="ui-row__main">
                        <span className="ui-row__title">{race.name}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>
                          {raceDetail(race, getYearFromDateKey(race.dateKey) !== currentYear)}
                        </span>
                      </span>
                      {days !== null ? (
                        <span className="ui-muted" style={{ color: "var(--ui-text-2)", flexShrink: 0 }}>
                          {days} {days === 1 ? "dia" : "dias"}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ── Resultados ── */}
          <section className="ui-section" aria-label={`Resultados de ${season}`}>
            <div className="ui-section__head" style={{ alignItems: "center" }}>
              <div>
                <h2 className="ui-h2">Resultados</h2>
                {prCount > 0 ? (
                  <p className="ui-muted">
                    {prCount} {prCount === 1 ? "recorde pessoal" : "recordes pessoais"} em {season}
                  </p>
                ) : null}
              </div>
              {seasons.length > 1 ? (
                <nav className="ui-seg" aria-label="Temporada">
                  {seasons.map((year) => (
                    <Link
                      key={year}
                      href={year === currentYear ? "/provas" : `/provas?temporada=${year}`}
                      className="ui-seg__item"
                      aria-current={year === season ? "true" : undefined}
                      scroll={false}
                    >
                      {year}
                    </Link>
                  ))}
                </nav>
              ) : (
                <span className="ui-muted">{season}</span>
              )}
            </div>
            {results.length ? (
              <div className="ui-card ui-list">
                {results.map((result) => {
                  const detail = [formatKm(result.distanceKm), result.badge].filter(Boolean).join(" · ");
                  const content = (
                    <>
                      <DateBlock dateKey={result.dateKey} />
                      <span className="ui-row__main">
                        <span className="ui-row__title">{result.name}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>{detail}</span>
                      </span>
                      <span className="ui-row__side">
                        <span className={`ui-row__value${result.isPR ? " ui-row__value--accent" : ""}`}>
                          {result.timeSec !== null ? formatDuration(result.timeSec) : "—"}
                        </span>
                        {result.isPR ? <span className="ui-tag-accent">recorde pessoal</span> : null}
                      </span>
                    </>
                  );
                  return result.activityId ? (
                    <a
                      key={result.id}
                      href={`https://www.strava.com/activities/${result.activityId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-row ui-row--date"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={result.id} className="ui-row ui-row--date">{content}</div>
                  );
                })}
              </div>
            ) : (
              <p className="ui-card ui-card--pad ui-muted">Nenhuma prova concluída em {season}.</p>
            )}
          </section>

          {/* ── Análises ── */}
          <section className="ui-section" aria-label="Análises">
            <div className="ui-section__head">
              <h2 className="ui-h2">Análises</h2>
            </div>
            <nav className="ui-card ui-list" aria-label="Análises de provas">
              {[
                { href: "/meias", label: "Meias maratonas", description: "Splits sobrepostos, prova a prova." },
                { href: "/buenos-aires", label: "Buenos Aires · histórico", description: "O ciclo e a maratona de 2026." },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="ui-row">
                  <span className="ui-row__main">
                    <span className="ui-row__title">{link.label}</span>
                    <span className="ui-muted">{link.description}</span>
                  </span>
                  <svg className="ui-row__chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </nav>
          </section>

          {/* ── Cadastro ── */}
          <details className="ui-card ui-details" style={{ marginTop: 12 }}>
            <summary>
              Gerenciar provas
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="ui-details__body">
              <p className="ui-muted">
                {upcomingRaces.length} {upcomingRaces.length === 1 ? "prova futura" : "provas futuras"} · fonte:{" "}
                {calendar.source === "upstash" ? "Upstash" : "lista padrão do código"}
                {calendar.redisConfigured ? "" : " (Redis ausente)"}. Provas passadas continuam salvas.
              </p>
              <RaceManagerClient initialRaces={upcomingRaces} todayKey={todayKey} />
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}

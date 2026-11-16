// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import Navbar from "../components/Navbar";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import { getStravaActivities } from "../lib/strava-client";
import { formatKm, formatNumber } from "../lib/format";
import { MARATHON_CYCLE_START_DATE, MARATHON_CYCLE_END_DATE } from "../lib/race-calendar";
import { buildBuenosAiresArchive, formatArchiveDuration, formatArchivePace } from "../lib/buenos-aires-archive";

export const metadata = { title: "Buenos Aires 2026 · Rafael Cabral" };

function Chevron() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default async function BuenosAiresPage() {
  // Busca só o ciclo fixo, para atividades novas não deslocarem este histórico.
  const activities = await getStravaActivities({
    after: Math.floor(MARATHON_CYCLE_START_DATE.getTime() / 1000) - 1,
    before: Math.floor(MARATHON_CYCLE_END_DATE.getTime() / 1000) + 1,
    maxPages: 20,
  });
  const archive = buildBuenosAiresArchive(activities);
  const { race, elapsedSeconds, trainingRuns, weeks } = archive;
  const hasTrainingData = trainingRuns.length > 0;
  const pace = race && elapsedSeconds ? elapsedSeconds / (race.distance / 1000) : null;
  const maxWeekKm = Math.max(1, ...weeks.map((week) => week.trainingKm + week.raceKm));

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <p className="ui-header__eyebrow">Arquivo da temporada 2026</p>
            <h1 className="ui-title">Buenos Aires</h1>
          </div>
        </header>

        <div className="hoje-col">
          {/* ── A prova ── */}
          <section className="ui-card ui-card--pad ui-stack" aria-labelledby="race-result-title">
            <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
              <p className="ui-label-accent" style={{ color: "var(--ui-good)" }}>Missão cumprida</p>
              <span className="ui-muted">domingo, 20 set 2026</span>
            </div>
            <div>
              <h2 id="race-result-title" className="hoje-race__title">Maratona de Buenos Aires</h2>
              <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>42,195 km · Argentina</p>
            </div>

            {race ? (
              <>
                <div className="hoje-race__row">
                  <p className="hoje-race__count">
                    <span className="hoje-race__count-value" style={{ fontSize: 52 }}>{formatArchiveDuration(elapsedSeconds)}</span>
                  </p>
                  <p className="hoje-race__pr">
                    <span className="ui-muted" style={{ fontSize: 12 }}>Pace médio</span>
                    <span className="hoje-race__pr-value">{formatArchivePace(pace)}</span>
                  </p>
                </div>
                <dl className="ui-dl">
                  <div><dt>Distância no GPS</dt><dd>{formatKm(race.distance / 1000, 2)}</dd></div>
                  <div><dt>FC média</dt><dd>{race.average_heartrate ? `${Math.round(race.average_heartrate)} bpm` : "—"}</dd></div>
                </dl>
                <p className="ui-muted">Tempo decorrido no Strava; o tempo oficial da organização pode ser diferente.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <a href={`https://www.strava.com/activities/${race.id}`} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--ghost">
                    Abrir no Strava
                  </a>
                  <ActivitySplitsChart activityId={race.id} activityName={race.name} />
                </div>
              </>
            ) : (
              <p style={{ fontSize: 14, color: "var(--ui-text-2)" }}>
                A conquista está registrada, mas a atividade de 20/09 ainda não veio do Strava. Tempo, pace e splits aparecem
                aqui quando ela sincronizar.
              </p>
            )}
          </section>

          {/* ── Preparação ── */}
          <section className="ui-section" aria-labelledby="cycle-summary-title">
            <div className="ui-section__head">
              <h2 id="cycle-summary-title" className="ui-h2">Preparação</h2>
              <span className="ui-muted">18/05 a 19/09</span>
            </div>
            {hasTrainingData ? (
              <div className="ui-stat-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {[
                  { label: `em ${trainingRuns.length} corridas`, value: formatKm(archive.trainingKm, 0), sub: null },
                  { label: "maior semana", value: formatKm(archive.peakWeekKm), sub: null },
                  { label: "maior corrida", value: formatKm(archive.longestRunKm), sub: null },
                  { label: "semanas", value: formatNumber(weeks.length), sub: null },
                ].map((stat) => (
                  <div key={stat.label} className="ui-stat">
                    <span className="ui-stat__value">{stat.value}</span>
                    <span className="ui-stat__label">{stat.sub ? `${stat.sub} · ` : ""}{stat.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ui-card ui-card--pad ui-muted">O histórico da preparação aparece quando as atividades do ciclo estiverem no Strava.</p>
            )}
            <p className="ui-muted" style={{ padding: "0 4px" }}>A maratona e os treinos depois dela ficam fora destes totais.</p>
          </section>

          {/* ── Volume semanal ── */}
          {hasTrainingData || race ? (
            <section className="ui-card ui-card--pad ui-stack" aria-labelledby="cycle-volume-title">
              <div>
                <h2 id="cycle-volume-title" className="ui-h2">Volume por semana</h2>
                <p className="ui-muted">Pico de {formatKm(archive.peakWeekKm, 0)}. A maratona aparece em verde na última semana.</p>
              </div>
              <div
                className="ba-weeks"
                role="img"
                aria-label={`Volume semanal de ${weeks.length} semanas, com pico de ${formatKm(archive.peakWeekKm, 0)}. Os valores exatos estão na tabela abaixo.`}
                style={{ gridTemplateColumns: `repeat(${Math.max(weeks.length, 1)}, minmax(0, 1fr))` }}
              >
                {weeks.map((week, index) => (
                  <div key={week.dateKey} className="ba-weeks__col">
                    <div className="ba-weeks__track">
                      {week.raceKm > 0 ? (
                        <div className="ba-weeks__bar ba-weeks__bar--race" style={{ height: `${(week.raceKm / maxWeekKm) * 100}%` }} />
                      ) : null}
                      <div className="ba-weeks__bar" style={{ height: `${(week.trainingKm / maxWeekKm) * 100}%` }} />
                    </div>
                    <span className="ba-weeks__label">{index % 3 === 0 || index === weeks.length - 1 ? week.label : ""}</span>
                  </div>
                ))}
              </div>
              <div className="carga-legend">
                <span className="carga-legend__item"><span className="carga-dot" style={{ background: "var(--ui-accent)" }} />Preparação</span>
                <span className="carga-legend__item"><span className="carga-dot" style={{ background: "var(--ui-good)" }} />Maratona</span>
              </div>
              <details className="ui-details" style={{ margin: "0 -20px -20px", borderTop: "1px solid var(--ui-border)" }}>
                <summary>Valores por semana<Chevron /></summary>
                <div className="ui-list">
                  {weeks.map((week) => (
                    <div key={week.dateKey} className="ui-row" style={{ minHeight: 44 }}>
                      <span className="ui-muted" style={{ color: "var(--ui-text-2)" }}>semana de {week.label}</span>
                      <span className="ui-row__side" style={{ flexDirection: "row", gap: 12 }}>
                        <span className="ui-num" style={{ fontSize: 15 }}>{formatKm(week.trainingKm)}</span>
                        {week.raceKm ? <span style={{ fontSize: 14, color: "var(--ui-good)" }}>+ {formatKm(week.raceKm, 2)} maratona</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          ) : null}

          {/* ── Continuar ── */}
          <nav className="ui-card ui-list" aria-label="Continuar" style={{ marginTop: 12 }}>
            {[
              { href: "/longoes#ciclo-buenos-aires", label: "Os longões do ciclo", description: "Planejado × executado até a maratona." },
              { href: "/provas", label: "Próximas provas", description: "A temporada continua." },
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
        </div>
      </main>
      <footer className="ui-footer">Rafael Cabral · Buenos Aires 2026 · projeto concluído</footer>
    </div>
  );
}

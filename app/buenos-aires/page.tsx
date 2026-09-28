export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import { getStravaActivities } from "../lib/strava-client";
import { MARATHON_CYCLE_START_DATE, MARATHON_CYCLE_END_DATE } from "../lib/race-calendar";
import { buildBuenosAiresArchive, formatArchiveDuration, formatArchivePace } from "../lib/buenos-aires-archive";

function km(value: number, digits = 1) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default async function BuenosAiresPage() {
  // Query the fixed cycle, so newer activities cannot displace this history.
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
    <>
      <Navbar />
      <main className="ba-page ba-archive">
        <section className="ba-archive-hero">
          <div>
            <p className="ba-eyebrow">Arquivo da temporada · 2026</p>
            <h1 className="ba-title">Buenos Aires.<br /><span>Missão cumprida.</span></h1>
            <p className="ba-archive-hero__copy">
              A linha de chegada virou parte da história. Aqui ficam a maratona
              de 20 de setembro e o caminho percorrido até ela.
            </p>
            <div className="ba-archive-actions">
              <Link href="/" className="ba-pill ba-pill-orange">Voltar à temporada →</Link>
              <Link href="/longoes#ciclo-buenos-aires" className="ba-pill ba-pill-dark">Rever os longões</Link>
            </div>
          </div>
          <div className="ba-archive-finish">
            <span className="badge badge--success">Projeto concluído</span>
            <p className="ba-archive-finish__distance">42,195<span>km</span></p>
            <p>Maratona de Buenos Aires</p>
            <p className="ba-muted">20 de setembro de 2026 · Argentina</p>
          </div>
        </section>

        <section className="ba-card ba-archive-section" aria-labelledby="race-result-title">
          <div className="ba-archive-section__head">
            <div>
              <p className="ba-eyebrow">A conquista</p>
              <h2 id="race-result-title">Registro da maratona</h2>
            </div>
            <span className="badge badge--success">Concluída</span>
          </div>
          {race ? (
            <>
              <div className="ba-grid-4 ba-archive-metrics">
                {[
                  { label: "Tempo decorrido", value: formatArchiveDuration(elapsedSeconds), detail: "registrado no Strava" },
                  { label: "Pace médio", value: formatArchivePace(pace), detail: "tempo decorrido / distância GPS" },
                  { label: "Distância GPS", value: `${km(race.distance / 1000, 2)} km`, detail: "distância oficial: 42,195 km" },
                  { label: "FC média", value: race.average_heartrate ? `${Math.round(race.average_heartrate)} bpm` : "—", detail: "registrada na atividade" },
                ].map((metric) => (
                  <div className="ba-card-soft" key={metric.label}>
                    <p className="ba-label">{metric.label}</p>
                    <p className="ba-value">{metric.value}</p>
                    <p className="ba-muted">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <p className="ba-muted ba-archive-note">Dados da atividade no Strava; o tempo oficial da organização pode ser diferente.</p>
              <div className="ba-archive-actions">
                <a href={`https://www.strava.com/activities/${race.id}`} target="_blank" rel="noopener noreferrer" className="ba-pill ba-pill-dark">Abrir atividade no Strava ↗</a>
                <ActivitySplitsChart activityId={race.id} activityName={race.name} />
              </div>
            </>
          ) : (
            <div className="ba-archive-empty">
              <p>A conquista está registrada. Os números da prova ainda não estão disponíveis.</p>
              <p className="ba-muted">O tempo, o ritmo e os splits aparecerão aqui quando a atividade de 20/09 estiver disponível na sincronização com o Strava.</p>
            </div>
          )}
        </section>

        <section className="ba-archive-section" aria-labelledby="cycle-summary-title">
          <div className="ba-archive-section__head">
            <div>
              <p className="ba-eyebrow">O caminho até a largada</p>
              <h2 id="cycle-summary-title">Preparação em números</h2>
              <p className="ba-muted">Corridas registradas de 18/05 a 19/09/2026. A maratona e os treinos posteriores ficam fora destes totais.</p>
            </div>
          </div>
          {hasTrainingData ? (
            <div className="ba-grid-4 ba-archive-metrics">
              {[
                { label: "Volume de preparação", value: `${km(archive.trainingKm, 0)} km` },
                { label: "Corridas registradas", value: String(trainingRuns.length) },
                { label: "Maior corrida", value: `${km(archive.longestRunKm)} km` },
                { label: "Maior semana", value: `${km(archive.peakWeekKm)} km` },
              ].map((metric) => (
                <div className="ba-card" key={metric.label}>
                  <p className="ba-label">{metric.label}</p>
                  <p className="ba-value">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="ba-card ba-archive-empty">
              <p className="ba-muted">O histórico da preparação será exibido quando as atividades do ciclo estiverem disponíveis no Strava.</p>
            </div>
          )}
        </section>

        {(hasTrainingData || race) && (
          <section className="ba-card ba-archive-section" aria-labelledby="cycle-volume-title">
            <div className="ba-archive-section__head">
              <div>
                <p className="ba-eyebrow">18 semanas · maio a setembro</p>
                <h2 id="cycle-volume-title">O volume que construiu a jornada</h2>
                <p className="ba-muted">Semanas iniciadas nas datas abaixo. A maratona aparece separada na última semana.</p>
              </div>
            </div>
            <div className="ba-archive-chart-legend"><span>● Preparação</span><span>● Maratona</span></div>
            <div className="ba-archive-chart-scroll" role="region" aria-label="Volume semanal do ciclo" tabIndex={0}>
              <div className="ba-archive-chart" role="img" aria-label="Gráfico de volume semanal. Os valores exatos estão na tabela abaixo.">
                {weeks.map((week) => (
                  <div className="ba-archive-week" key={week.dateKey} title={`${week.label}: ${km(week.trainingKm)} km de preparação; ${km(week.raceKm)} km na maratona`}>
                    <span className="ba-archive-week__value">{km(week.trainingKm + week.raceKm, 0)}</span>
                    <div className="ba-archive-week__track">
                      {week.raceKm > 0 && <div className="ba-archive-week__race" style={{ height: `${week.raceKm / maxWeekKm * 100}%` }} />}
                      <div className="ba-archive-week__training" style={{ height: `${week.trainingKm / maxWeekKm * 100}%` }} />
                    </div>
                    <span>{week.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <details className="ba-archive-table-details">
              <summary>Ver os valores por semana</summary>
              <table className="ba-archive-table">
                <thead><tr><th scope="col">Semana de</th><th scope="col">Preparação</th><th scope="col">Maratona</th></tr></thead>
                <tbody>{weeks.map((week) => <tr key={week.dateKey}><th scope="row">{week.label}</th><td>{km(week.trainingKm)} km</td><td>{week.raceKm ? `${km(week.raceKm, 2)} km` : "—"}</td></tr>)}</tbody>
              </table>
            </details>
          </section>
        )}

        <section className="ba-grid-2 ba-archive-next">
          <Link href="/longoes#ciclo-buenos-aires" className="ba-card">
            <p className="ba-eyebrow">Memória do ciclo</p><h2>Os longões até Buenos Aires →</h2>
            <p className="ba-muted">Reveja o planejamento, a execução e os treinos que fizeram parte dessa preparação.</p>
          </Link>
          <Link href="/provas" className="ba-card">
            <p className="ba-eyebrow">A jornada continua</p><h2>Próximas provas →</h2>
            <p className="ba-muted">Acompanhe os compromissos cadastrados no calendário e os próximos capítulos da temporada.</p>
          </Link>
        </section>
      </main>
      <footer className="site-footer">RAFAEL CABRAL · BUENOS AIRES 2026 · PROJETO CONCLUÍDO</footer>
    </>
  );
}

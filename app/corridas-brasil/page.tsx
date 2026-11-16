// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Navbar from "../components/Navbar";
import BrazilRaceMap from "../components/BrazilRaceMap";
import { RaceGroupList, TopRacesList, getTopRacesByPace } from "../components/RaceGroupList";
import { formatDayMonth, formatKm, formatNumber } from "../lib/format";
import { getRaceCalendarData, getRaceCalendarTodayKey, getUpcomingBrazilManagedRaces } from "../lib/race-calendar";
import { getCurrentSeasonYear, getYearFromDateKey } from "../lib/season";
import {
  formatRaceEfficiency,
  getBrazilStateCountsFromStrava,
  getRaceLikeActivitiesFromStrava,
  getStravaRaceStats,
  groupStravaRacesByStateBrazil,
  type RaceLikeEntry,
} from "../lib/strava-races";

export const metadata = { title: "Corridas pelo Brasil · Rafael Cabral" };

const isFiveK = (race: RaceLikeEntry) => race.distanceKm >= 4.5 && race.distanceKm < 7.5;
const isTenK = (race: RaceLikeEntry) => race.distanceKm >= 9 && race.distanceKm < 15;
const isHalfMarathon = (race: RaceLikeEntry) => race.distanceKm >= 20 && race.distanceKm < 25;

export default async function CorridasBrasilPage() {
  const [allRaces, raceCalendar] = await Promise.all([
    getRaceLikeActivitiesFromStrava(),
    getRaceCalendarData(),
  ]);

  const races = allRaces.filter((race) => race.country === "Brasil");
  const todayKey = getRaceCalendarTodayKey();
  const currentYear = getCurrentSeasonYear();
  const upcomingBrazilRaces = getUpcomingBrazilManagedRaces(raceCalendar.races, todayKey, 8);

  const grouped = groupStravaRacesByStateBrazil(races);
  const stats = getStravaRaceStats(races);
  const counts = getBrazilStateCountsFromStrava(races);
  const leader = grouped[0];

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container">
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Corridas pelo Brasil</h1>
            <p className="ui-muted">Provas identificadas no Strava, por estado</p>
          </div>
        </header>

        <div className="hoje-col">
          <div className="ui-stat-grid">
            <div className="ui-stat">
              <span className="ui-stat__value">{formatNumber(stats.totalRaces)}</span>
              <span className="ui-stat__label">provas no Brasil</span>
            </div>
            <div className="ui-stat">
              <span className="ui-stat__value">{formatNumber(stats.statesCount)}</span>
              <span className="ui-stat__label">{leader ? `estados · mais provas: ${leader.stateName ?? leader.state}` : "estados"}</span>
            </div>
            <div className="ui-stat">
              <span className="ui-stat__value">{formatRaceEfficiency(stats.averageEfficiency)}</span>
              <span className="ui-stat__label">eficiência média</span>
            </div>
          </div>

          <section aria-label="Mapa do Brasil" style={{ minWidth: 0 }}>
            <BrazilRaceMap counts={counts} />
          </section>

          <section className="ui-section" aria-label="Melhores marcas">
            <div className="ui-section__head">
              <h2 className="ui-h2">Melhores marcas</h2>
              <span className="ui-muted">por pace médio</span>
            </div>
            <div className="race-podiums">
              <TopRacesList title="Meias maratonas" races={getTopRacesByPace(races, isHalfMarathon)} />
              <TopRacesList title="10 km" races={getTopRacesByPace(races, isTenK)} />
              <TopRacesList title="5 km" races={getTopRacesByPace(races, isFiveK)} />
            </div>
          </section>

          {upcomingBrazilRaces.length > 0 ? (
            <section className="ui-section" aria-label="Próximas provas no Brasil">
              <div className="ui-section__head">
                <h2 className="ui-h2">Próximas no Brasil</h2>
              </div>
              <div className="ui-card ui-list">
                {upcomingBrazilRaces.map((race) => {
                  const [day, month] = formatDayMonth(race.dateKey).split(" ");
                  const year = getYearFromDateKey(race.dateKey);
                  return (
                    <div key={race.id} className="ui-row ui-row--date">
                      <span className="ui-date">
                        <span className="ui-date__day">{day}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>{month}</span>
                      </span>
                      <span className="ui-row__main">
                        <span className="ui-row__title">{race.name}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>
                          {[year !== currentYear ? String(year) : null, race.location, race.objective, race.badge].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="ui-row__value" style={{ flexShrink: 0 }}>{formatKm(race.distanceKm, race.distanceKm % 1 === 0 ? 0 : 1)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="ui-section" aria-label="Provas por estado">
            <div className="ui-section__head">
              <h2 className="ui-h2">Por estado</h2>
              <span className="ui-muted">toque para ver as provas</span>
            </div>
            <RaceGroupList
              groups={grouped.map((item) => ({ key: item.state, title: item.stateName ?? item.state, races: item.races }))}
              emptyText="Nenhuma prova no Brasil foi identificada no Strava."
            />
          </section>
        </div>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {currentYear}</footer>
    </div>
  );
}

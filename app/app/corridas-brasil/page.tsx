export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { formatBRDate } from "../lib/date-utils";
import BrazilRaceMap from "../components/BrazilRaceMap";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import {
  getRaceLikeActivitiesFromStrava,
  groupStravaRacesByStateBrazil,
  getStravaRaceStats,
  getBrazilStateCountsFromStrava,
  formatRacePace,
  formatRaceEfficiency,
} from "../lib/strava-races";

type Race = {
  id: number | string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  date: string;
  distanceKm: number;
  time: string;
  paceSecPerKm?: number | null;
  elevationGain?: number;
  averageHeartrate?: number | null;
  efficiency?: number | null;
};

function parseTimeToSeconds(time: string) {
  const parts = time.split(":").map(Number);

  if (parts.some(Number.isNaN)) return Number.POSITIVE_INFINITY;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return Number.POSITIVE_INFINITY;
}

function getPaceSeconds(race: Race) {
  const totalSeconds = parseTimeToSeconds(race.time);

  if (!Number.isFinite(totalSeconds) || !race.distanceKm) {
    return Number.POSITIVE_INFINITY;
  }

  return totalSeconds / race.distanceKm;
}

function formatPaceFromRace(race: Race) {
  if (race.paceSecPerKm) return formatRacePace(race.paceSecPerKm);

  const paceSeconds = getPaceSeconds(race);

  if (!Number.isFinite(paceSeconds)) return "-";

  const min = Math.floor(paceSeconds / 60);
  const sec = Math.round(paceSeconds % 60);

  if (sec === 60) return `${min + 1}:00/km`;

  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function getTrend(current?: number | null, previous?: number | null) {
  if (!current || !previous) return "➖";
  const diff = current - previous;
  if (Math.abs(diff) < 1) return "➖";
  return diff > 0 ? "📈" : "📉";
}

function isFiveK(race: Race) {
  return race.distanceKm >= 4.5 && race.distanceKm < 7.5;
}

function isTenK(race: Race) {
  return race.distanceKm >= 9 && race.distanceKm < 15;
}

function isHalfMarathon(race: Race) {
  return race.distanceKm >= 20 && race.distanceKm < 25;
}

function getTopRaces(races: Race[], filterFn: (race: Race) => boolean) {
  return races
    .filter(filterFn)
    .map((race) => ({
      ...race,
      paceSeconds: getPaceSeconds(race),
    }))
    .filter((race) => Number.isFinite(race.paceSeconds))
    .sort((a, b) => {
      if (a.paceSeconds !== b.paceSeconds) {
        return a.paceSeconds - b.paceSeconds;
      }

      return parseTimeToSeconds(a.time) - parseTimeToSeconds(b.time);
    })
    .slice(0, 3);
}

function getMedalMeta(index: number) {
  if (index === 0) return { label: "Ouro",   icon: "🥇", badgeClass: "badge--accent" };
  if (index === 1) return { label: "Prata",  icon: "🥈", badgeClass: "badge--muted"  };
  return             { label: "Bronze", icon: "🥉", badgeClass: "badge--orange" };
}

export default async function CorridasBrasilPage() {
  const allRaces = await getRaceLikeActivitiesFromStrava();

  const races = allRaces.filter((race) => race.country === "Brasil");

  const grouped = groupStravaRacesByStateBrazil(races);
  const stats = getStravaRaceStats(races);
  const counts = getBrazilStateCountsFromStrava(races);

  const topHalf = getTopRaces(races, isHalfMarathon);
  const top10k = getTopRaces(races, isTenK);
  const top5k = getTopRaces(races, isFiveK);

  return (
    <div className="page"><Navbar />
    <main className="ba-page">
        <div className="ba-section flex items-center justify-between">
          <div>
            <p className="ba-eyebrow">Corridas</p>
            <h1 className="ba-title">Corridas pelo Brasil</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>Corridas puxadas do Strava e identificadas como provas no Brasil.</p>
          </div>

          <Link
            href="/"
            className="ba-back"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <section className="ba-section ba-grid-4">
          <InfoCard title="Corridas no Brasil" value={String(stats.totalRaces)} />
          <InfoCard
            title="Estados com corridas"
            value={String(stats.statesCount)}
          />
          <InfoCard
            title="Estado líder"
            value={grouped[0]?.stateName ?? grouped[0]?.state ?? "-"}
          />
          <InfoCard
            title="Eficiência média"
            value={formatRaceEfficiency(stats.averageEfficiency)}
          />
        </section>

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Top 3 por distância</p>
          <p className="ba-muted" style={{ marginTop: 4 }}>
            Ranking automático das melhores provas no Brasil por pace médio,
            separado em meias, 10k e 5k.
          </p>

          <div className="br-top-distance-grid">
            <TopDistanceCard title="Top 3 Meias" races={topHalf} />
            <TopDistanceCard title="Top 3 10k" races={top10k} />
            <TopDistanceCard title="Top 3 5k" races={top5k} />
          </div>
        </section>

        <section className="ba-section">
          <BrazilRaceMap counts={counts} />
        </section>

        <section className="ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Ranking por estado</p>
          <p className="ba-muted" style={{ marginTop: ".4rem", marginBottom: "1.25rem" }}>Lista detalhada das corridas identificadas como eventos/provas no Brasil.</p>

          {grouped.length === 0 ? (
            <p className="ba-muted" style={{ marginTop: 20 }}>
              Nenhuma corrida foi identificada com a regra atual.
            </p>
          ) : (
            <div className="br-state-grid">
              {grouped.map((item) => (
                <div
                  key={item.state}
                  className="ba-card-soft br-state-card"
                >
                  <div className="br-state-card__header">
                    <p className="br-state-card__title">{item.stateName}</p>
                    <span className="badge badge--accent">{item.count} {item.count === 1 ? "corrida" : "corridas"}</span>
                  </div>

                  <div className="br-race-list">
                    {item.races.map((race, index) => {
                      const previous = item.races[index + 1];

                      return (
                        <div key={race.id} className="br-race-card">
                          <div style={{ minWidth: 0 }}>
                            <p className="br-race-card__name">{race.name}</p>
                            <p className="br-race-card__details">{race.city || "Não identificado"}{race.state ? `, ${race.state}` : ""} · {formatBRDate(race.date)} · {race.distanceKm.toFixed(2)} km · {race.time} · {formatPaceFromRace(race)}</p>
                            <p className="br-race-card__stats">FC {race.averageHeartrate ? `${race.averageHeartrate.toFixed(0)} bpm` : "-"} · Alt {race.elevationGain ?? 0} m · Ef {formatRaceEfficiency(race.efficiency ?? null)} · {getTrend(race.efficiency, previous?.efficiency)}</p>
                          </div>
                          <ActivitySplitsChart
                            activityId={Number(String(race.id).replace("strava-", ""))}
                            activityName={race.name}
                            targetPaceSecPerKm={race.paceSecPerKm ?? undefined}
                            goalPaceSecPerKm={320}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </main>
    <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

function TopDistanceCard({
  title,
  races,
}: {
  title: string;
  races: Array<Race & { paceSeconds: number }>;
}) {
  return (
    <div className="ba-card-soft br-top-distance-card">
      <p className="ba-eyebrow" style={{ marginBottom: 8 }}>{title}</p>

      {races.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          Nenhuma prova encontrada nessa categoria.
        </p>
      ) : (
        <div className="br-top-distance-list">
          {races.map((race, index) => {
            const medal = getMedalMeta(index);
            const isTopOne = index === 0;

            return (
              <div
                key={race.id}
                className="br-top-race-card"
              >
                <div className="br-top-race-card__head">
                  <p className="br-top-race-card__name">{race.name}</p>

                  <span className={`badge ${medal.badgeClass ?? "badge--muted"}`}>{medal.icon} {medal.label}</span>
                </div>

                <p style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                  {race.city || "Não identificado"}
                  {race.state ? `, ${race.state}` : ""} •{" "}
                  {formatBRDate(race.date)}
                </p>

                <p style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                  {race.distanceKm.toFixed(2)} km • {race.time} •{" "}
                  <span className={isTopOne ? "font-bold text-white" : ""}>
                    {formatPaceFromRace(race)}
                  </span>
                </p>

                <p style={{ marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>
                  Eficiência {formatRaceEfficiency(race.efficiency ?? null)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
      <p className="ba-label">{title}</p>
      <h2 className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem" }}>{value}</h2>
    </div>
  );
}
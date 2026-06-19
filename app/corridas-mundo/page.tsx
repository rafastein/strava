export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { formatBRDate } from "../lib/date-utils";
import WorldRaceMap from "../components/WorldRaceMap";
import ActivitySplitsChart from "../components/ActivitySplitsChart";
import {
  getRaceLikeActivitiesFromStrava,
  groupStravaRacesByCountry,
  getStravaRaceStats,
  getCountryCountsFromStrava,
  formatRacePace,
  formatRaceEfficiency,
} from "../lib/strava-races";

const HALF_MARATHON_KM = 21;

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
  gearName?: string | null;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeCountryDisplay(country: string) {
  const normalized = normalizeText(country);

  if (normalized.includes("paraguay") || normalized.includes("paraguai")) {
    return "Paraguai";
  }

  if (normalized === "deutschland" || normalized === "germany") {
    return "Alemanha";
  }

  if (normalized === "brazil") return "Brasil";
  if (normalized === "japan") return "Japão";

  if (
    normalized === "united states" ||
    normalized === "united states of america"
  ) {
    return "Estados Unidos";
  }

  if (normalized === "netherlands" || normalized === "holanda") {
    return "Países Baixos";
  }

  return country;
}

function getCountryCode(country: string) {
  const normalized = normalizeText(country);

  if (normalized === "brasil" || normalized === "brazil") return "br";

  if (
    normalized === "alemanha" ||
    normalized === "germany" ||
    normalized === "deutschland"
  ) {
    return "de";
  }

  if (normalized === "portugal") return "pt";
  if (normalized === "peru") return "pe";
  if (normalized === "argentina") return "ar";

  if (normalized.includes("paraguay") || normalized.includes("paraguai")) {
    return "py";
  }

  if (
    normalized === "japao" ||
    normalized === "japão" ||
    normalized === "japan"
  ) {
    return "jp";
  }

  if (
    normalized === "estados unidos" ||
    normalized === "united states" ||
    normalized === "united states of america" ||
    normalized === "eua" ||
    normalized === "usa"
  ) {
    return "us";
  }

  if (
    normalized === "paises baixos" ||
    normalized === "países baixos" ||
    normalized === "netherlands" ||
    normalized === "holanda"
  ) {
    return "nl";
  }

  if (
    normalized === "franca" ||
    normalized === "frança" ||
    normalized === "france"
  ) {
    return "fr";
  }

  if (normalized === "espanha" || normalized === "spain") return "es";

  if (
    normalized === "italia" ||
    normalized === "itália" ||
    normalized === "italy"
  ) {
    return "it";
  }

  if (
    normalized === "reino unido" ||
    normalized === "united kingdom" ||
    normalized === "uk"
  ) {
    return "gb";
  }

  if (normalized === "chile") return "cl";
  if (normalized === "mexico" || normalized === "méxico") return "mx";
  if (normalized === "canada" || normalized === "canadá") return "ca";
  if (normalized === "australia" || normalized === "austrália") return "au";
  if (normalized === "irlanda" || normalized === "ireland") return "ie";

  if (
    normalized === "suica" ||
    normalized === "suíça" ||
    normalized === "switzerland"
  ) {
    return "ch";
  }

  if (normalized === "austria" || normalized === "áustria") return "at";

  if (
    normalized === "belgica" ||
    normalized === "bélgica" ||
    normalized === "belgium"
  ) {
    return "be";
  }

  if (normalized === "dinamarca" || normalized === "denmark") return "dk";

  if (
    normalized === "suecia" ||
    normalized === "suécia" ||
    normalized === "sweden"
  ) {
    return "se";
  }

  if (normalized === "noruega" || normalized === "norway") return "no";

  if (
    normalized === "finlandia" ||
    normalized === "finlândia" ||
    normalized === "finland"
  ) {
    return "fi";
  }

  if (
    normalized === "polonia" ||
    normalized === "polônia" ||
    normalized === "poland"
  ) {
    return "pl";
  }

  if (
    normalized === "tchequia" ||
    normalized === "tchéquia" ||
    normalized === "republica tcheca" ||
    normalized === "república tcheca" ||
    normalized === "czechia"
  ) {
    return "cz";
  }

  if (normalized === "hungria" || normalized === "hungary") return "hu";

  if (
    normalized === "grecia" ||
    normalized === "grécia" ||
    normalized === "greece"
  ) {
    return "gr";
  }

  if (normalized === "turquia" || normalized === "turkey") return "tr";

  if (
    normalized === "africa do sul" ||
    normalized === "áfrica do sul" ||
    normalized === "south africa"
  ) {
    return "za";
  }

  if (
    normalized === "emirados arabes unidos" ||
    normalized === "emirados árabes unidos" ||
    normalized === "united arab emirates"
  ) {
    return "ae";
  }

  if (
    normalized === "nova zelandia" ||
    normalized === "nova zelândia" ||
    normalized === "new zealand"
  ) {
    return "nz";
  }

  return "";
}

function CountryFlag({ country }: { country: string }) {
  const code = getCountryCode(country);

  if (!code) {
    return (
      <span className="flex h-5 w-7 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-[10px] font-bold text-white/40">
        ?
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`Bandeira de ${normalizeCountryDisplay(country)}`}
      className="h-5 w-7 rounded-[2px] object-cover shadow-sm shadow-black/20"
      loading="lazy"
    />
  );
}

function formatRaceName(name: string) {
  return String(name ?? "")
    .replace(/^\s*Prova:\s*/i, "")
    .replace(/\s*\*{3}\s*$/g, "")
    .trim();
}

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

function formatPaceFromRace(race: Race) {
  if (race.paceSecPerKm) return formatRacePace(race.paceSecPerKm);

  const totalSeconds = parseTimeToSeconds(race.time);

  if (!Number.isFinite(totalSeconds) || !race.distanceKm) return "-";

  const paceSeconds = totalSeconds / race.distanceKm;
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

function formatRaceGear(race: Race) {
  return race.gearName?.trim() || "-";
}

function getTopRaceMedals(
  races: Array<{ id: number | string; time: string; distanceKm: number }>
) {
  const ranked = [...races]
    .map((race) => {
      const totalSeconds = parseTimeToSeconds(race.time);
      const paceSeconds = totalSeconds / race.distanceKm;

      return {
        id: race.id,
        paceSeconds,
      };
    })
    .filter((race) => Number.isFinite(race.paceSeconds))
    .sort((a, b) => a.paceSeconds - b.paceSeconds)
    .slice(0, 3);

  const medals = ["🥇", "🥈", "🥉"];
  const medalMap = new Map<number | string, string>();

  ranked.forEach((race, index) => {
    medalMap.set(race.id, medals[index]);
  });

  return medalMap;
}

export default async function CorridasMundoPage() {
  const allRaces = await getRaceLikeActivitiesFromStrava();
  const races = allRaces.filter((race) => race.distanceKm >= HALF_MARATHON_KM);

  const grouped = groupStravaRacesByCountry(races);
  const stats = getStravaRaceStats(races);
  const counts = getCountryCountsFromStrava(races);
  const topRaceMedals = getTopRaceMedals(races);

  return (
    <div className="page">
      <Navbar />
      <main className="ba-page">
        <div className="ba-section flex items-center justify-between">
          <div>
            <p className="ba-eyebrow">Corridas</p>
            <h1 className="ba-title">Corridas pelo mundo</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Corridas puxadas do Strava com distância mínima de 21 km.
            </p>
          </div>

          <Link href="/" className="ba-back">
            Voltar ao dashboard
          </Link>
        </div>

        <section className="ba-section ba-grid-4">
          <InfoCard title="Corridas 21k+" value={String(stats.totalRaces)} />
          <InfoCard
            title="Países com corridas"
            value={String(stats.countriesCount)}
          />
          <InfoCard
            title="País líder"
            value={grouped[0] ? normalizeCountryDisplay(grouped[0].country) : "-"}
          />
          <InfoCard
            title="Eficiência média"
            value={formatRaceEfficiency(stats.averageEfficiency)}
          />
        </section>

        <section className="ba-section">
          <WorldRaceMap counts={counts} />
        </section>

        <section className="ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Ranking por país</p>
          <p className="ba-muted" style={{ marginTop: ".4rem", marginBottom: "1.25rem" }}>
            Lista detalhada das corridas identificadas como eventos/provas com
            distância mínima de 21 km. As medalhas destacam os 3 melhores paces
            médios da página.
          </p>

          {grouped.length === 0 ? (
            <p className="ba-muted">
              Nenhuma corrida acima de 21 km foi identificada com a regra atual.
            </p>
          ) : (
            <div className="world-country-grid">
              {grouped.map((item) => {
                const displayCountry = normalizeCountryDisplay(item.country);

                return (
                  <div key={item.country} className="ba-card-soft world-country-card">
                    {/* País header */}
                    <div className="world-country-card__header">
                      <p className="world-country-card__title">
                        <CountryFlag country={item.country} />
                        <span>{displayCountry}</span>
                      </p>
                      <span className="badge badge--accent">
                        {item.count} {item.count === 1 ? "corrida" : "corridas"}
                      </span>
                    </div>

                    {/* Corridas */}
                    <div className="world-race-list">
                      {item.races.map((race: Race, index) => {
                        const medal    = topRaceMedals.get(race.id);
                        const previous = item.races[index + 1];

                        return (
                          <div key={race.id} className="world-race-card">
                            <div style={{ minWidth: 0 }}>
                              {/* Nome */}
                              <p className="world-race-card__name">
                                {medal && (
                                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                                    {medal}
                                  </span>
                                )}
                                <span className="world-race-card__name-text">
                                  {formatRaceName(race.name)}
                                </span>
                              </p>

                              {/* Detalhes */}
                              <p className="world-race-card__details">
                                {race.city || "Não identificado"}
                                {race.state ? `, ${race.state}` : ""} · {formatBRDate(race.date)} · {race.distanceKm.toFixed(2)} km · {race.time} · {formatPaceFromRace(race)} · Tênis: {formatRaceGear(race)}
                              </p>

                              {/* Stats */}
                              <p className="world-race-card__stats">
                                FC {race.averageHeartrate ? `${race.averageHeartrate.toFixed(0)} bpm` : "-"} · Alt {race.elevationGain ?? 0} m · Ef {formatRaceEfficiency(race.efficiency ?? null)} · {getTrend(race.efficiency, previous?.efficiency)}
                              </p>
                            </div>

                            <ActivitySplitsChart
                              activityId={Number(String(race.id).replace("strava-", ""))}
                              activityName={formatRaceName(race.name)}
                              targetPaceSecPerKm={race.paceSecPerKm ?? undefined}
                              goalPaceSecPerKm={320}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="ba-card" style={{ padding: "1.5rem", textAlign: "center" }}>
      <p className="ba-label">{title}</p>
      <h2 className="ba-value" style={{ fontSize: 30, marginTop: ".4rem" }}>
        {value}
      </h2>
    </div>
  );
}
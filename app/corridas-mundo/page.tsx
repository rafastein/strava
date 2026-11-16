// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Navbar from "../components/Navbar";
import WorldRaceMap from "../components/WorldRaceMap";
import { RaceGroupList, TopRacesList, getTopRacesByPace } from "../components/RaceGroupList";
import { formatNumber } from "../lib/format";
import { getCurrentSeasonYear } from "../lib/season";
import {
  formatRaceEfficiency,
  getCountryCountsFromStrava,
  getRaceLikeActivitiesFromStrava,
  getStravaRaceStats,
  groupStravaRacesByCountry,
} from "../lib/strava-races";

export const metadata = { title: "Corridas pelo mundo · Rafael Cabral" };

const HALF_MARATHON_KM = 21;

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
      <span aria-hidden="true" style={{ display: "inline-flex", width: 28, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 3, border: "1px solid var(--ui-border-strong)", fontSize: 12, color: "var(--ui-muted)" }}>
        ?
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      width={28}
      height={20}
      style={{ borderRadius: 3, objectFit: "cover", flexShrink: 0 }}
      loading="lazy"
    />
  );
}

export default async function CorridasMundoPage() {
  const allRaces = await getRaceLikeActivitiesFromStrava();
  const races = allRaces.filter((race) => race.distanceKm >= HALF_MARATHON_KM);

  const grouped = groupStravaRacesByCountry(races);
  const stats = getStravaRaceStats(races);
  const counts = getCountryCountsFromStrava(races);
  const topRaces = getTopRacesByPace(races, () => true);
  const rankById = new Map(topRaces.map((race, index) => [race.id, index + 1] as const));
  const leader = grouped[0];

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container">
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Corridas pelo mundo</h1>
            <p className="ui-muted">Provas de 21 km ou mais identificadas no Strava, por país</p>
          </div>
        </header>

        <div className="hoje-col">
          <div className="ui-stat-grid">
            <div className="ui-stat">
              <span className="ui-stat__value">{formatNumber(stats.totalRaces)}</span>
              <span className="ui-stat__label">provas de 21 km+</span>
            </div>
            <div className="ui-stat">
              <span className="ui-stat__value">{formatNumber(stats.countriesCount)}</span>
              <span className="ui-stat__label">{leader ? `países · mais provas: ${normalizeCountryDisplay(leader.country)}` : "países"}</span>
            </div>
            <div className="ui-stat">
              <span className="ui-stat__value">{formatRaceEfficiency(stats.averageEfficiency)}</span>
              <span className="ui-stat__label">eficiência média</span>
            </div>
          </div>

          <section aria-label="Mapa-múndi" style={{ minWidth: 0 }}>
            <WorldRaceMap counts={counts} />
          </section>

          <section className="ui-section" aria-label="Melhores marcas">
            <div className="ui-section__head">
              <h2 className="ui-h2">Melhores marcas</h2>
              <span className="ui-muted">por pace médio</span>
            </div>
            <TopRacesList title="Provas de 21 km ou mais" races={topRaces} />
          </section>

          <section className="ui-section" aria-label="Provas por país">
            <div className="ui-section__head">
              <h2 className="ui-h2">Por país</h2>
              <span className="ui-muted">toque para ver as provas</span>
            </div>
            <RaceGroupList
              groups={grouped.map((item) => ({
                key: item.country,
                title: normalizeCountryDisplay(item.country),
                leading: <CountryFlag country={item.country} />,
                races: item.races,
              }))}
              rankById={rankById}
              emptyText="Nenhuma prova de 21 km ou mais foi identificada no Strava."
            />
          </section>
        </div>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

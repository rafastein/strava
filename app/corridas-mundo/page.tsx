export const dynamic = "force-dynamic";

import Link from "next/link";
import WorldRaceMap from "../components/WorldRaceMap";
import {
  getRaceLikeActivitiesFromStrava,
  groupStravaRacesByCountry,
  getStravaRaceStats,
  getCountryCountsFromStrava,
} from "../lib/strava-races";

const HALF_MARATHON_KM = 21;

function getCountryCode(country: string) {
  const map: Record<string, string> = {
    Brasil: "br",
    Alemanha: "de",
    "Estados Unidos": "us",
    Japão: "jp",
    Portugal: "pt",
    Espanha: "es",
    França: "fr",
    Itália: "it",
    Argentina: "ar",
    Chile: "cl",
    Paraguai: "py",
    Peru: "pe",
    México: "mx",
    Canadá: "ca",
    Austrália: "au",
    Irlanda: "ie",
    Suíça: "ch",
    Áustria: "at",
    Bélgica: "be",
    "Países Baixos": "nl",
    Dinamarca: "dk",
    Suécia: "se",
    Noruega: "no",
    Finlândia: "fi",
    Polônia: "pl",
    Tchéquia: "cz",
    "República Tcheca": "cz",
    Hungria: "hu",
    Grécia: "gr",
    Turquia: "tr",
    "Reino Unido": "gb",
    "África do Sul": "za",
    "Emirados Árabes Unidos": "ae",
    "Nova Zelândia": "nz",
  };

  return map[country] ?? "";
}

function CountryFlag({ country }: { country: string }) {
  const code = getCountryCode(country);

  if (!code) {
    return (
      <span className="flex h-5 w-7 items-center justify-center rounded-sm bg-gray-200 text-[10px] font-bold text-gray-500">
        ?
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={`Bandeira de ${country}`}
      className="h-5 w-7 rounded-[2px] object-cover shadow-sm"
      loading="lazy"
    />
  );
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
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Corridas</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Corridas pelo mundo
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Corridas puxadas do Strava com distância mínima de 21 km.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Voltar ao dashboard
          </Link>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <InfoCard title="Corridas 21k+" value={String(stats.totalRaces)} />
          <InfoCard
            title="Países com corridas"
            value={String(stats.countriesCount)}
          />
          <InfoCard title="País líder" value={grouped[0]?.country ?? "-"} />
          <InfoCard title="Origem" value="Strava" />
        </section>

        <section className="mb-8">
          <WorldRaceMap counts={counts} />
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Ranking por país
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Lista detalhada das corridas identificadas como eventos/provas com
            distância mínima de 21 km. As medalhas destacam os 3 melhores paces
            médios da página.
          </p>

          {grouped.length === 0 ? (
            <p className="mt-5 text-sm text-gray-500">
              Nenhuma corrida acima de 21 km foi identificada com a regra atual.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {grouped.map((item) => (
                <div
                  key={item.country}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                      <CountryFlag country={item.country} />
                      <span>{item.country}</span>
                    </p>

                    <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                      {item.count} corridas
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {item.races.map((race) => {
                      const medal = topRaceMedals.get(race.id);

                      return (
                        <div
                          key={race.id}
                          className="rounded-xl bg-white p-3 text-sm text-gray-700"
                        >
                          <p className="flex items-center gap-2 font-medium text-gray-900">
                            {medal ? (
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-sm"
                                title="Top 3 melhores paces"
                              >
                                {medal}
                              </span>
                            ) : null}
                            <span>{race.name}</span>
                          </p>

                          <p className="text-gray-500">
                            {race.city || "Não identificado"}
                            {race.state ? `, ${race.state}` : ""} •{" "}
                            {new Date(race.date).toLocaleDateString("pt-BR")} •{" "}
                            {race.distanceKm.toFixed(2)} km • {race.time}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <h2 className="mt-2 text-2xl font-bold text-gray-900">{value}</h2>
    </div>
  );
}
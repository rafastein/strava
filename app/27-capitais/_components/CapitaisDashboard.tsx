import Navbar from "../../components/Navbar";
import CapitalsBrazilMap from "../../components/CapitalsBrazilMap";
import CapitalMedalGrid from "../../components/CapitalMedalGrid";
import { getValidStravaAccessToken } from "../../lib/strava-auth";
import {
  getStravaActivities as fetchStravaActivities,
  getStravaActivityDetail,
  getStravaActivityPhotos,
  getStravaAthlete,
  type StravaAthlete,
} from "../../lib/strava-client";
import {
  buildCapitalChallenge,
  capitals,
  formatDateBR,
  formatDistance,
  formatPace,
  formatTime,
  type CapitalChallengeItem,
  type StravaActivity,
} from "../../lib/capitals-challenge";
import { formatKm } from "../../lib/format";
import { getManagedRaces, type ManagedRace } from "../../lib/race-calendar";

type Athlete = StravaAthlete;

type StravaPhotoMap = Record<number, string>;

type CapitalRaceCalendarItem = {
  races: string;
  dateLabel: string;
};

const pendingRaceCalendar: Record<string, CapitalRaceCalendarItem> = {
  AC: { races: "8ª Meia Maratona Acre Running", dateLabel: "Abril" },
  AL: {
    races: "Maratona Internacional de Maceió / Meia Maratona Coop",
    dateLabel: "Agosto / Setembro",
  },
  AP: {
    races: "Maratona de Macapá / 3ª Meia Maratona de Macapá",
    dateLabel: "Março / Julho",
  },
  AM: {
    races: "Maratona Internacional de Manaus / Meia Maratona Foco Run",
    dateLabel: "Abril / Maio",
  },
  BA: { races: "21K Salvador / Maratona Salvador", dateLabel: "Abril / Setembro" },
  CE: {
    races: "Maratona Internacional de Fortaleza / 21K Terra da Luz",
    dateLabel: "Abril / Maio",
  },
  DF: { races: "Maratona Monumental de Brasília", dateLabel: "Novembro" },
  ES: { races: "Maratona de Vitória", dateLabel: "Agosto" },
  MA: { races: "Maratona Internacional de São Luís", dateLabel: "Julho" },
  MT: {
    races: "4ª Meia Maratona de Cuiabá / Maratona & Meia Maratona de Cuiabá",
    dateLabel: "Maio / Dezembro",
  },
  MS: {
    races: "Meia Cidade Morena / Maratona de Campo Grande",
    dateLabel: "Abril / Julho",
  },
  MG: {
    races: "Maratona Oficial de BH / Maratona & Meia Internacional de BH",
    dateLabel: "Maio / Junho",
  },
  PA: { races: "Corrida da Amazônia / Meia Maratona da Amazônia", dateLabel: "Setembro" },
  PB: {
    races: "Jampa 21K / Maratona de João Pessoa / Meia Maratona de João Pessoa",
    dateLabel: "Abril / Novembro",
  },
  PR: { races: "Maratona de Curitiba", dateLabel: "Novembro" },
  PE: {
    races: "Meia Maratona do Recife / Meia Maratona Eu Amo Recife",
    dateLabel: "Março / Setembro",
  },
  PI: { races: "Meia Maratona de Teresina", dateLabel: "Setembro" },
  RJ: {
    races: "Maratona do Rio / Rio 21K / Meia Maratona do Rio",
    dateLabel: "Junho / Agosto",
  },
  RN: { races: "Meia Maratona do Sol", dateLabel: "Setembro" },
  RS: { races: "Maratona de Porto Alegre", dateLabel: "Maio" },
  RO: { races: "Meia Maratona Internacional de Porto Velho", dateLabel: "Agosto" },
  RR: { races: "Meia Maratona de Roraima", dateLabel: "Outubro" },
  SC: {
    races: "Meia Maratona Internacional de Florianópolis / Maratona de Floripa / SC21K",
    dateLabel: "Maio / Agosto / Novembro",
  },
  SP: {
    races: "Meia Maratona Internacional de São Paulo / Maratona de São Paulo",
    dateLabel: "Janeiro / Abril",
  },
  SE: {
    races: "Meia Maratona do Parque / Maratona de Aracaju / Meia da Conceição",
    dateLabel: "Julho / Outubro / Dezembro",
  },
  TO: {
    races: "Meia Maratona das Praias / Meia Maratona do Tocantins",
    dateLabel: "Junho / Dezembro",
  },
};

function getCalendarInfo(state: string) {
  return pendingRaceCalendar[state];
}

function normalizeCalendarText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function getTodayBrazilDateKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const STATE_NAMES_BY_CODE: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const CAPITAL_ALIASES_BY_STATE: Record<string, string[]> = {
  MG: ["Belo Horizonte", "BH"],
  SC: ["Florianópolis", "Floripa"],
  SP: ["São Paulo", "Sampa"],
  RJ: ["Rio de Janeiro", "Rio"],
  DF: ["Brasília", "Brasilia", "BSB"],
  GO: ["Goiânia", "Goiania"],
  PA: ["Belém", "Belem"],
  PB: ["João Pessoa", "Joao Pessoa", "Jampa"],
  PE: ["Recife"],
  RN: ["Natal"],
  RS: ["Porto Alegre", "POA"],
  RO: ["Porto Velho"],
  RR: ["Boa Vista"],
  ES: ["Vitória", "Vitoria"],
  MA: ["São Luís", "Sao Luis", "São Luiz", "Sao Luiz"],
  MS: ["Campo Grande"],
  MT: ["Cuiabá", "Cuiaba"],
  AC: ["Rio Branco"],
  AL: ["Maceió", "Maceio"],
  AP: ["Macapá", "Macapa"],
  AM: ["Manaus"],
  BA: ["Salvador"],
  CE: ["Fortaleza"],
  PI: ["Teresina"],
  SE: ["Aracaju"],
  TO: ["Palmas"],
};

function includesNormalizedText(haystack: string, needle: string) {
  const normalizedNeedle = normalizeCalendarText(needle);
  return Boolean(normalizedNeedle) && haystack.includes(normalizedNeedle);
}

function includesNormalizedToken(haystack: string, token: string) {
  const normalizedToken = normalizeCalendarText(token);
  if (!normalizedToken) return false;
  return new RegExp(`(?:^|[^a-z0-9])${normalizedToken}(?:[^a-z0-9]|$)`).test(haystack);
}

function getRaceSearchText(race: ManagedRace) {
  return normalizeCalendarText([
    race.name,
    race.location,
    race.badge ?? "",
    race.objective ?? "",
  ].join(" "));
}

function formatDateKeyBR(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
}

function isCapitalMissionRace(race: ManagedRace, capital: CapitalChallengeItem) {
  if (race.distanceKm < 20 || race.distanceKm > 25) return false;

  const searchText = getRaceSearchText(race);
  const aliases = CAPITAL_ALIASES_BY_STATE[capital.state] ?? [capital.city];
  const stateName = STATE_NAMES_BY_CODE[capital.state] ?? "";

  const matchesCapitalName = aliases.some((alias) => includesNormalizedText(searchText, alias));
  const matchesStateCode = includesNormalizedToken(searchText, capital.state);
  const matchesStateName = includesNormalizedText(searchText, stateName);
  const hasMissionHint =
    includesNormalizedText(searchText, "27 capitais") ||
    includesNormalizedText(searchText, "capital") ||
    includesNormalizedText(searchText, "missão") ||
    includesNormalizedText(searchText, "missao");

  // Match forte: nome/local tem a capital, inclusive apelidos como BH, Floripa, BSB ou Jampa.
  if (matchesCapitalName) return true;

  // Match por UF/estado: funciona quando a prova cadastrada vem como "Belo Horizonte MG",
  // "Goiás", "PR" etc. O hint evita transformar qualquer meia genérica em missão.
  return (matchesStateCode || matchesStateName) && hasMissionHint;
}

function buildUpcomingRaceByState(races: ManagedRace[], challenge: CapitalChallengeItem[], todayKey: string) {
  const pendingCapitals = challenge.filter((capital) => !capital.bestActivity);
  const result = new Map<string, ManagedRace>();

  for (const capital of pendingCapitals) {
    const race = races
      .filter((item) => item.dateKey >= todayKey && isCapitalMissionRace(item, capital))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.name.localeCompare(b.name, "pt-BR"))[0];

    if (race) result.set(capital.state, race);
  }

  return result;
}

function getRaceLabel(capital: CapitalChallengeItem, managedRace?: ManagedRace) {
  if (capital.bestActivity) return cleanActivityName(capital.bestActivity.name);
  if (managedRace) return managedRace.name;
  return getCalendarInfo(capital.state)?.races ?? "—";
}

function getDateLabel(capital: CapitalChallengeItem, managedRace?: ManagedRace) {
  if (capital.bestActivity) return formatDateBR(capital.bestActivity.start_date_local);
  if (managedRace) return formatDateKeyBR(managedRace.dateKey);
  return getCalendarInfo(capital.state)?.dateLabel ?? "—";
}

function getDateSortValue(capital: CapitalChallengeItem, managedRace?: ManagedRace) {
  const label = getDateLabel(capital, managedRace);
  const fullDateMatch = label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (fullDateMatch) {
    const [, day, month, year] = fullDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const monthOrder: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    março: 3,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const firstMonth = label
    .split(/[\/,-]/)[0]
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (firstMonth && monthOrder[firstMonth]) {
    return new Date(new Date().getFullYear(), monthOrder[firstMonth] - 1, 1).getTime();
  }

  return Number.POSITIVE_INFINITY;
}

async function getAthlete(accessToken: string): Promise<Athlete | null> {
  return getStravaAthlete(accessToken);
}

async function getStravaActivities(accessToken: string) {
  return fetchStravaActivities({ accessToken, maxPages: 8 }) as Promise<StravaActivity[]>;
}

function extractBestPhotoUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value.startsWith("http") ? value : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractBestPhotoUrl(item);
      if (url) return url;
    }
    return null;
  }

  if (typeof value !== "object") return null;

  const data = value as Record<string, unknown>;

  const directUrl = extractBestPhotoUrl(data.url) ?? extractBestPhotoUrl(data.src) ?? extractBestPhotoUrl(data.href);
  if (directUrl) return directUrl;

  const urls = data.urls;
  if (urls && typeof urls === "object" && !Array.isArray(urls)) {
    const entries = Object.entries(urls as Record<string, unknown>)
      .filter(([, url]) => typeof url === "string" && String(url).startsWith("http"))
      .sort(([a], [b]) => Number(b) - Number(a));

    if (entries[0]?.[1]) return String(entries[0][1]);
  }

  const nestedCandidates = [
    data.primary,
    data.default_photo,
    data.media,
    data.photo,
    data.photos,
    data.sizes,
  ];

  for (const candidate of nestedCandidates) {
    const url = extractBestPhotoUrl(candidate);
    if (url) return url;
  }

  return null;
}

async function getActivityCoverPhotos(accessToken: string, activityIds: number[]): Promise<StravaPhotoMap> {
  const uniqueIds = Array.from(new Set(activityIds));
  const photoEntries = await Promise.all(
    uniqueIds.map(async (activityId) => {
      try {
        const photosPayload = await getStravaActivityPhotos(activityId, 1000, accessToken);
        const photoUrl = extractBestPhotoUrl(photosPayload);
        if (photoUrl) return [activityId, photoUrl] as const;

        const activityPayload = await getStravaActivityDetail(activityId, accessToken);
        const fallbackUrl = extractBestPhotoUrl((activityPayload as Record<string, unknown> | null)?.photos);

        return fallbackUrl ? ([activityId, fallbackUrl] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  return photoEntries.reduce<StravaPhotoMap>((acc, entry) => {
    if (entry) acc[entry[0]] = entry[1];
    return acc;
  }, {});
}

function cleanActivityName(name?: string) {
  if (!name) return "Meia maratona identificada";

  return name
    .replace(/^prova:\s*/i, "")
    .replace(/^race:\s*/i, "")
    .trim();
}
export default async function CapitaisPage() {
  const accessToken = await getValidStravaAccessToken();

  let athlete: Athlete | null = null;
  let activities: StravaActivity[] = [];

  if (accessToken) {
    const [fetchedAthlete, fetchedActivities] = await Promise.all([
      getAthlete(accessToken),
      getStravaActivities(accessToken),
    ]);

    athlete = fetchedAthlete;
    activities = fetchedActivities;
  }

  const raceCalendar = await getManagedRaces();
  const rawChallenge = buildCapitalChallenge(activities);
  const registeredRaces = raceCalendar.source === "upstash" ? raceCalendar.races : [];
  const upcomingRaceByState = buildUpcomingRaceByState(registeredRaces, rawChallenge, getTodayBrazilDateKey());
  const challenge: CapitalChallengeItem[] = rawChallenge.map((capital) => ({
    ...capital,
    status: capital.bestActivity ? "completed" : upcomingRaceByState.has(capital.state) ? "next" : "locked",
  }));

  const completed = challenge.filter((capital) => capital.status === "completed");
  const next = challenge.filter((capital) => capital.status === "next");
  const nextByDate = [...next].sort(
    (a, b) =>
      getDateSortValue(a, upcomingRaceByState.get(a.state)) - getDateSortValue(b, upcomingRaceByState.get(b.state)) ||
      a.city.localeCompare(b.city, "pt-BR", { sensitivity: "base" }),
  );
  const progress = Math.round((completed.length / capitals.length) * 100);
  const regions = ["Centro-Oeste", "Sudeste", "Sul", "Nordeste", "Norte"];

  const fastest = [...completed]
    .filter((capital) => capital.bestActivity)
    .sort(
      (a, b) =>
        (a.bestActivity?.moving_time ?? Infinity) -
        (b.bestActivity?.moving_time ?? Infinity),
    )[0];

  const capitalRows = [...challenge].sort((a, b) =>
    a.city.localeCompare(b.city, "pt-BR", { sensitivity: "base" }),
  );

  const totalKm = completed.reduce((acc, c) => acc + (c.bestActivity?.distance ?? 0) / 1000, 0);

  const avgPaceSeconds = completed.length > 0
    ? completed.reduce((acc, c) => {
        if (!c.bestActivity) return acc;
        return acc + c.bestActivity.moving_time / (c.bestActivity.distance / 1000);
      }, 0) / completed.length
    : null;

  function formatAvgPace(secPerKm: number | null) {
    if (!secPerKm) return "—";
    const min = Math.floor(secPerKm / 60);
    const sec = Math.round(secPerKm % 60);
    return `${min}:${String(sec).padStart(2, "0")}/km`;
  }

  const remaining = capitals.length - completed.length;
  const capitalsPerYear = 4;
  const yearsLeft = remaining / capitalsPerYear;
  const currentYear = new Date().getFullYear();
  const estimatedYear = Math.ceil(currentYear + yearsLeft);

  const rankedCompleted = [...completed]
    .filter((c) => c.bestActivity)
    .sort((a, b) => (a.bestActivity?.moving_time ?? Infinity) - (b.bestActivity?.moving_time ?? Infinity));

  const completedActivityIds = completed
    .map((capital) => capital.bestActivity?.id)
    .filter((id): id is number => typeof id === "number");

  const activityPhotosById: StravaPhotoMap =
    accessToken && completedActivityIds.length > 0
      ? await getActivityCoverPhotos(accessToken, completedActivityIds)
      : {};

  const mapItems = challenge.map((capital) => ({
    state: capital.state,
    city: capital.city,
    status: capital.status,
    raceLabel: getRaceLabel(capital, upcomingRaceByState.get(capital.state)),
    dateLabel: getDateLabel(capital, upcomingRaceByState.get(capital.state)),
    time: capital.bestActivity ? formatTime(capital.bestActivity.moving_time) : undefined,
    pace: capital.bestActivity
      ? formatPace(capital.bestActivity.distance, capital.bestActivity.moving_time)
      : undefined,
    photoUrl: capital.bestActivity ? activityPhotosById[capital.bestActivity.id] : undefined,
    activityUrl: capital.bestActivity
      ? `https://www.strava.com/activities/${capital.bestActivity.id}`
      : undefined,
  }));

  const statusMeta: Record<CapitalChallengeItem["status"], { label: string; color: string }> = {
    completed: { label: "Concluída", color: "var(--ui-good)" },
    next: { label: "Próxima", color: "var(--ui-accent)" },
    locked: { label: "A definir", color: "var(--ui-muted)" },
  };

  return (
    <div className="ui-page">
      <Navbar
        athleteName={athlete?.firstname ?? undefined}
        athleteAvatar={athlete?.profile_medium ?? undefined}
      />

      <main className="ui-container">
        <header className="ui-header">
          <div>
            <h1 className="ui-title">27 Capitais</h1>
            <p className="ui-muted">Uma meia maratona em cada capital brasileira</p>
          </div>
        </header>

        <div className="hoje-grid">
          <div className="hoje-col">
            {/* ── Progresso ── */}
            <section className="ui-card ui-card--pad ui-stack" aria-label="Progresso do desafio">
              <p className="ui-label-accent">Progresso</p>
              <p className="hoje-week__total">
                <span className="hoje-week__km">{completed.length} de {capitals.length}</span>
                <span className="ui-muted" style={{ fontSize: 14 }}>capitais · {progress}%</span>
              </p>
              <div className="hoje-progress" role="img" aria-label={`${progress}% do desafio concluído`}>
                <div className="hoje-progress__fill" style={{ width: `${progress}%` }} />
              </div>
              <dl className="ui-dl">
                <div><dt>Km nas capitais</dt><dd>{formatKm(totalKm, 0)}</dd></div>
                <div>
                  <dt>Melhor meia</dt>
                  <dd>{fastest?.bestActivity ? formatTime(fastest.bestActivity.moving_time) : "—"}</dd>
                  {fastest ? <dd className="ui-muted" style={{ fontFamily: "inherit", fontWeight: 400, fontSize: 12 }}>{fastest.city}</dd> : null}
                </div>
                <div><dt>Pace médio</dt><dd>{formatAvgPace(avgPaceSeconds)}</dd></div>
                <div>
                  <dt>Conclusão estimada</dt>
                  <dd>{remaining > 0 ? estimatedYear : "Concluído"}</dd>
                  {remaining > 0 ? (
                    <dd className="ui-muted" style={{ fontFamily: "inherit", fontWeight: 400, fontSize: 12 }}>
                      {remaining} restantes, a {capitalsPerYear} por ano
                    </dd>
                  ) : null}
                </div>
              </dl>
            </section>

            {/* ── Próximas ── */}
            <section className="ui-section" aria-label="Próximas capitais">
              <div className="ui-section__head">
                <h2 className="ui-h2">Próximas capitais</h2>
                <span className="ui-muted">
                  {raceCalendar.source === "upstash" ? `${registeredRaces.length} provas cadastradas` : "sem provas cadastradas"}
                </span>
              </div>
              {next.length > 0 ? (
                <div className="ui-card ui-list">
                  {nextByDate.map((capital) => {
                    const managedRace = upcomingRaceByState.get(capital.state);
                    return (
                      <div key={capital.city} className="ui-row">
                        <span className="ui-row__main">
                          <span className="ui-row__title">
                            {capital.city} <span className="ui-muted">{capital.state}</span>
                          </span>
                          <span className="ui-muted" style={{ whiteSpace: "normal" }}>{getRaceLabel(capital, managedRace)}</span>
                        </span>
                        <span className="ui-row__side">
                          <span className="ui-row__value" style={{ fontSize: 15 }}>{getDateLabel(capital, managedRace)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="ui-card ui-card--pad ui-muted">
                  Nenhuma capital pendente tem prova cadastrada. Cadastre em Provas para ela aparecer aqui.
                </p>
              )}
            </section>

            {/* ── Regiões ── */}
            <section className="ui-section" aria-label="Progresso por região">
              <div className="ui-section__head">
                <h2 className="ui-h2">Por região</h2>
              </div>
              <div className="ui-card ui-list">
                {regions.map((region) => {
                  const regionCapitals = challenge.filter((capital) => capital.region === region);
                  const regionCompleted = regionCapitals.filter((capital) => capital.status === "completed");
                  const regionProgress = regionCapitals.length
                    ? Math.round((regionCompleted.length / regionCapitals.length) * 100)
                    : 0;
                  return (
                    <div key={region} className="ui-row" style={{ minHeight: 56 }}>
                      <span className="ui-row__main" style={{ flex: 1, gap: 6 }}>
                        <span className="ui-row__title">{region}</span>
                        <span className="tenis-wear" role="img" aria-label={`${regionProgress}% concluído`}>
                          <span className="tenis-wear__fill" style={{ width: `${regionProgress}%`, background: "var(--ui-accent)" }} />
                        </span>
                      </span>
                      <span className="ui-row__value">{regionCompleted.length} de {regionCapitals.length}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="hoje-col">
            {/* ── Mapa ── */}
            <section aria-label="Mapa das capitais" style={{ minWidth: 0 }}>
              <CapitalsBrazilMap items={mapItems} />
            </section>
          </div>
        </div>

        {/* ── Medalhas ── */}
        <section className="ui-section" style={{ marginTop: 12 }} aria-label="Medalhas">
          <CapitalMedalGrid items={challenge} />
        </section>

        {/* ── Ranking ── */}
        {rankedCompleted.length > 0 ? (
          <section className="ui-section" style={{ marginTop: 12 }} aria-label="Ranking das capitais">
            <div className="ui-section__head">
              <h2 className="ui-h2">Ranking por tempo</h2>
              <span className="ui-muted">melhor meia de cada capital</span>
            </div>
            <div className="ui-card ui-list">
              {rankedCompleted.map((capital, idx) => {
                const act = capital.bestActivity!;
                return (
                  <a
                    key={capital.city}
                    href={`https://www.strava.com/activities/${act.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-row ui-row--date"
                  >
                    <span className="ui-date">
                      <span className="ui-date__day" style={idx === 0 ? { color: "var(--ui-accent)" } : undefined}>{idx + 1}º</span>
                    </span>
                    <span className="ui-row__main">
                      <span className="ui-row__title">
                        {capital.city} <span className="ui-muted">{capital.state}</span>
                        {capital.otherHalfMarathons.length > 0 ? (
                          <span className="ui-muted" style={{ fontSize: 12 }}> · +{capital.otherHalfMarathons.length} {capital.otherHalfMarathons.length === 1 ? "meia" : "meias"}</span>
                        ) : null}
                      </span>
                      <span className="ui-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[cleanActivityName(act.name), formatDateBR(act.start_date_local), act.average_heartrate ? `${act.average_heartrate.toFixed(0)} bpm` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="ui-row__side">
                      <span className={`ui-row__value${idx === 0 ? " ui-row__value--accent" : ""}`}>{formatTime(act.moving_time)}</span>
                      <span className="ui-muted">{formatPace(act.distance, act.moving_time)}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Todas as capitais ── */}
        <details className="ui-card ui-details" style={{ marginTop: 24 }}>
          <summary>
            Todas as 27 capitais, em ordem alfabética
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="ui-list" style={{ borderTop: "1px solid var(--ui-border)" }}>
            {capitalRows.map((capital) => {
              const activity = capital.bestActivity;
              const managedRace = upcomingRaceByState.get(capital.state);
              const meta = statusMeta[capital.status];
              return (
                <div key={capital.city} className="ui-row" style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
                  <span className="ui-row__main">
                    <span className="ui-row__title">
                      {capital.city} <span className="ui-muted">{capital.state} · {capital.region}</span>
                    </span>
                    <span className="ui-muted" style={{ fontSize: 12, whiteSpace: "normal" }}>
                      {getRaceLabel(capital, managedRace)}
                    </span>
                    <span className="ui-muted" style={{ fontSize: 12 }}>
                      {activity
                        ? `${getDateLabel(capital, managedRace)} · ${formatDistance(activity.distance)} · ${formatPace(activity.distance, activity.moving_time)}`
                        : getDateLabel(capital, managedRace)}
                    </span>
                  </span>
                  <span className="ui-row__side">
                    <span className="ui-row__value" style={activity ? undefined : { color: "var(--ui-muted)", fontWeight: 400 }}>
                      {activity ? formatTime(activity.moving_time) : "—"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        <details className="ui-card ui-details" style={{ marginTop: 12 }}>
          <summary>
            Regras do desafio
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="ui-details__body">
            <p>A capital só entra como concluída se houver uma meia maratona no Strava perto da cidade.</p>
            <p>Se houver mais de uma meia na mesma capital, vale a mais rápida.</p>
            <p>Capitais pendentes mostram o mês das principais meias mapeadas; as próximas mostram a data da prova cadastrada.</p>
          </div>
        </details>
      </main>
    </div>
  );
}

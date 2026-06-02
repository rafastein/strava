export const dynamic = "force-dynamic";

import type { CSSProperties } from "react";
import Navbar from "../components/Navbar";
import CapitalsBrazilMap from "../components/CapitalsBrazilMap";
import CapitalMedalGrid from "../components/CapitalMedalGrid";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import {
  buildCapitalChallenge,
  capitals,
  formatDateBR,
  formatDistance,
  formatPace,
  formatTime,
  getStatusLabel,
  type CapitalChallengeItem,
  type StravaActivity,
} from "../lib/capitals-challenge";

type Athlete = {
  firstname?: string | null;
  profile_medium?: string | null;
};

type StravaPhotoMap = Record<number, string>;

type CapitalRaceCalendarItem = {
  races: string;
  dateLabel: string;
};

const confirmedNextRace: Record<string, CapitalRaceCalendarItem> = {
  GO: {
    races: "Meia Maratona de Goiânia",
    dateLabel: "18/10/2026",
  },
  MG: {
    races: "Maratona & Meia Internacional de BH",
    dateLabel: "28/06/2026",
  },
  PR: {
    races: "Meia de Curitiba",
    dateLabel: "15/11/2026",
  },
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
  return confirmedNextRace[state] ?? pendingRaceCalendar[state];
}

function getRaceLabel(capital: CapitalChallengeItem) {
  if (capital.bestActivity) return cleanActivityName(capital.bestActivity.name);
  return getCalendarInfo(capital.state)?.races ?? "—";
}

function getDateLabel(capital: CapitalChallengeItem) {
  if (capital.bestActivity) return formatDateBR(capital.bestActivity.start_date_local);
  return getCalendarInfo(capital.state)?.dateLabel ?? "—";
}

function getDateSortValue(capital: CapitalChallengeItem) {
  const label = getDateLabel(capital);
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
  try {
    const response = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getStravaActivities(accessToken: string) {
  const allActivities: StravaActivity[] = [];

  for (let page = 1; page <= 8; page++) {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (!response.ok) break;

    const data = (await response.json()) as StravaActivity[];
    if (!Array.isArray(data) || data.length === 0) break;

    allActivities.push(...data);

    if (data.length < 200) break;
  }

  return allActivities;
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
        const photosResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}/photos?size=1000`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          },
        );

        if (photosResponse.ok) {
          const photosPayload = await photosResponse.json();
          const photoUrl = extractBestPhotoUrl(photosPayload);
          if (photoUrl) return [activityId, photoUrl] as const;
        }

        const activityResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=false`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          },
        );

        if (!activityResponse.ok) return null;

        const activityPayload = await activityResponse.json();
        const fallbackUrl = extractBestPhotoUrl((activityPayload as Record<string, unknown>).photos);

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

function getStatusPillStyle(status: CapitalChallengeItem["status"]): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    padding: "0 0.68rem",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  if (status === "completed") {
    return {
      ...base,
      border: "1px solid rgba(16,185,129,0.25)",
      background: "rgba(16,185,129,0.12)",
      color: "#34d399",
    };
  }

  if (status === "next") {
    return {
      ...base,
      border: "1px solid rgba(245,166,35,0.25)",
      background: "rgba(245,166,35,0.12)",
      color: "var(--accent)",
    };
  }

  return {
    ...base,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.055)",
    color: "rgba(255,255,255,0.46)",
  };
}


function getTableCellToneStyle(status: CapitalChallengeItem["status"]): CSSProperties {
  if (status === "completed") {
    return {
      background: "linear-gradient(180deg, rgba(16,185,129,0.09), rgba(255,255,255,0.025))",
      borderBottom: "1px solid rgba(16,185,129,0.14)",
    };
  }

  if (status === "next") {
    return {
      background: "linear-gradient(180deg, rgba(245,166,35,0.10), rgba(255,255,255,0.03))",
      borderBottom: "1px solid rgba(245,166,35,0.14)",
    };
  }

  return {};
}

function getMobileCardToneStyle(status: CapitalChallengeItem["status"]): CSSProperties {
  if (status === "completed") {
    return {
      border: "1px solid rgba(16,185,129,0.22)",
      background: "linear-gradient(180deg, rgba(16,185,129,0.11), rgba(255,255,255,0.025))",
    };
  }

  if (status === "next") {
    return {
      border: "1px solid rgba(245,166,35,0.22)",
      background: "linear-gradient(180deg, rgba(245,166,35,0.12), rgba(255,255,255,0.03))",
    };
  }

  return {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
  };
}

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "green" | "red";
}) {
  const color =
    tone === "accent"
      ? "var(--accent)"
      : tone === "green"
        ? "#34d399"
        : tone === "red"
          ? "rgba(239,68,68,0.92)"
          : "#fff";

  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.075)",
        background: "rgba(0,0,0,0.20)",
        padding: "0.78rem 0.82rem",
      }}
    >
      <p className="ba-label" style={{ whiteSpace: "nowrap", fontSize: 10 }}>
        {label}
      </p>
      <p
        style={{
          marginTop: 5,
          color,
          fontSize: 15,
          fontWeight: 900,
          lineHeight: 1.05,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function cleanActivityName(name?: string) {
  if (!name) return "Meia maratona identificada";

  return name
    .replace(/^prova:\s*/i, "")
    .replace(/^race:\s*/i, "")
    .trim();
}
const styles: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "var(--capitals-hero-padding)",
    borderBottom: "1px solid var(--border)",
  },
  heroInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "var(--capitals-hero-grid)",
    gap: "var(--capitals-hero-gap)",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--capitals-title-size)",
    lineHeight: 0.9,
    letterSpacing: "0.02em",
    color: "var(--text)",
    marginTop: "0.85rem",
    marginBottom: "1rem",
  },
  heroText: {
    maxWidth: "var(--capitals-text-max-width)",
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    lineHeight: 1.7,
  },
  heroCards: {
    display: "grid",
    gridTemplateColumns: "var(--capitals-cards-grid)",
    gap: "1rem",
    alignItems: "stretch",
  },
  heroPanel: {
    borderRadius: 18,
    border: "1px solid rgba(245,166,35,0.18)",
    background: "linear-gradient(180deg, rgba(245,166,35,0.08), rgba(255,255,255,0.03))",
    padding: "1.25rem",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
  },
  nextPanel: {
    borderRadius: 18,
    border: "1px solid rgba(245,166,35,0.22)",
    background: "linear-gradient(180deg, rgba(245,166,35,0.10), rgba(255,255,255,0.03))",
    padding: "1.25rem",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "var(--capitals-stat-grid)",
    gap: 10,
  },
  statCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.075)",
    background: "rgba(0,0,0,0.22)",
    padding: "var(--capitals-stat-card-padding)",
  },
  content: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "var(--capitals-content-padding)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: "1rem",
    marginBottom: "1rem",
  },
  sectionTitle: {
    marginTop: "0.35rem",
    color: "#fff",
    fontSize: "var(--capitals-section-title-size)",
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  paddedCard: {
    padding: "1.25rem",
  },
  capitalMiniCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "0.85rem",
    minHeight: 82,
  },
  nextMissionCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.22)",
    padding: "0.9rem",
  },
  rule: {
    borderRadius: 14,
    background: "rgba(0,0,0,0.20)",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "0.85rem",
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 1.55,
  },
  regionGrid: {
    display: "grid",
    gridTemplateColumns: "var(--capitals-region-grid)",
    gap: "0.9rem",
    marginTop: "1rem",
  },
};

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

  const rawChallenge = buildCapitalChallenge(activities);
  const challenge: CapitalChallengeItem[] = rawChallenge.map((capital) => ({
    ...capital,
    status: capital.bestActivity ? "completed" : confirmedNextRace[capital.state] ? "next" : "locked",
  }));

  const completed = challenge.filter((capital) => capital.status === "completed");
  const next = challenge.filter((capital) => capital.status === "next");
  const nextByDate = [...next].sort(
    (a, b) =>
      getDateSortValue(a) - getDateSortValue(b) ||
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

  const slowest = [...completed]
    .filter((c) => c.bestActivity)
    .sort((a, b) => (b.bestActivity?.moving_time ?? 0) - (a.bestActivity?.moving_time ?? 0))[0];

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
    raceLabel: getRaceLabel(capital),
    dateLabel: getDateLabel(capital),
    time: capital.bestActivity ? formatTime(capital.bestActivity.moving_time) : undefined,
    pace: capital.bestActivity
      ? formatPace(capital.bestActivity.distance, capital.bestActivity.moving_time)
      : undefined,
    photoUrl: capital.bestActivity ? activityPhotosById[capital.bestActivity.id] : undefined,
    activityUrl: capital.bestActivity
      ? `https://www.strava.com/activities/${capital.bestActivity.id}`
      : undefined,
  }));

  return (
    <div className="page capitals-page">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .capitals-page {
              --capitals-hero-padding: 3rem 1.5rem 2.5rem;
              --capitals-hero-grid: minmax(0, 0.9fr) minmax(460px, 1.1fr);
              --capitals-hero-gap: 2rem;
              --capitals-title-size: clamp(3.2rem, 6.5vw, 5.7rem);
              --capitals-text-max-width: 560px;
              --capitals-cards-grid: minmax(0, 1.1fr) minmax(260px, 0.9fr);
              --capitals-top-stat-grid: repeat(3, minmax(0, 1fr));
              --capitals-stat-grid: repeat(2, minmax(0, 1fr));
              --capitals-stat-card-padding: 1rem 1.1rem;
              --capitals-content-padding: 1.75rem 1.5rem 4rem;
              --capitals-section-title-size: clamp(2rem, 3.2vw, 3rem);
              --capitals-region-grid: repeat(auto-fit, minmax(170px, 1fr));
              overflow-x: hidden;
            }

            .capitals-table-wrap {
              margin-top: 1rem;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }

            .capitals-table-wrap table {
              min-width: 960px;
            }

            .capitals-mobile-list {
              display: none;
            }

            .capitals-mobile-card {
              min-width: 0;
              border-radius: 16px;
              padding: 0.95rem;
              box-shadow: 0 18px 48px rgba(0,0,0,0.18);
            }

            .capitals-mobile-metrics {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.5rem;
              margin-top: 0.8rem;
            }

            @media (max-width: 1100px) {
              .capitals-page {
                --capitals-hero-grid: 1fr;
                --capitals-text-max-width: 760px;
                --capitals-cards-grid: 1fr;
              }
            }

            @media (max-width: 760px) {
              .capitals-page {
                --capitals-hero-padding: 2rem 0.95rem 1.45rem;
                --capitals-hero-gap: 1.15rem;
                --capitals-title-size: clamp(2.55rem, 14vw, 3.55rem);
                --capitals-top-stat-grid: repeat(2, minmax(0, 1fr));
                --capitals-stat-grid: repeat(2, minmax(0, 1fr));
                --capitals-stat-card-padding: 0.82rem;
                --capitals-content-padding: 1.15rem 0.95rem 3rem;
                --capitals-section-title-size: clamp(1.8rem, 9vw, 2.35rem);
                --capitals-region-grid: repeat(2, minmax(0, 1fr));
              }

              .capitals-hero-text {
                font-size: 14px !important;
                line-height: 1.6 !important;
              }

              .capitals-panel {
                padding: 1rem !important;
                border-radius: 16px !important;
              }

              .capitals-stat-card .ba-value {
                font-size: 26px !important;
              }

              .capitals-status-pill {
                height: 20px !important;
                padding: 0 0.55rem !important;
                font-size: 8px !important;
                letter-spacing: 0.1em !important;
              }

              .capitals-table-wrap {
                display: none !important;
              }

              .capitals-mobile-list {
                display: grid !important;
                gap: 0.75rem;
                margin-top: 1rem;
              }
            }

            @media (max-width: 430px) {
              .capitals-page {
                --capitals-hero-padding: 1.75rem 0.85rem 1.25rem;
                --capitals-content-padding: 1rem 0.85rem 2.75rem;
                --capitals-top-stat-grid: 1fr;
                --capitals-stat-grid: 1fr;
                --capitals-region-grid: 1fr;
              }

              .capitals-mobile-metrics {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
      <Navbar
        athleteName={athlete?.firstname ?? undefined}
        athleteAvatar={athlete?.profile_medium ?? undefined}
      />

      <section className="capitals-hero" style={styles.hero}>
        <div className="home-hero__glow-1" />
        <div className="home-hero__glow-2" />

        <div className="capitals-hero-inner" style={styles.heroInner}>
          <div>
            <p className="ba-eyebrow">Projeto 27 capitais</p>

            <h1 className="capitals-hero-title" style={styles.heroTitle}>Correndo pelas Capitais.</h1>

            <p className="capitals-hero-text" style={styles.heroText}>
              Um projeto para correr uma meia maratona em cada uma das 27 capitais
              brasileiras. Os dados concluídos vêm do Strava; as capitais pendentes
              mostram o mês das principais meias mapeadas.
            </p>
          </div>

          <div className="capitals-hero-cards" style={styles.heroCards}>
            <div className="capitals-panel" style={styles.heroPanel}>
              <p className="ba-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
                Correndo o Brasil
              </p>

              <div style={{ ...styles.statGrid, gridTemplateColumns: "var(--capitals-top-stat-grid)" }}>
                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Concluídas</p>
                  <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                    {completed.length}/27
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Progresso</p>
                  <p className="ba-value ba-value--accent" style={{ fontSize: 30, marginTop: 6 }}>
                    {progress}%
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Km acumulado</p>
                  <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                    {totalKm.toFixed(0)} km
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Melhor meia</p>
                  <p className="ba-value" style={{ fontSize: 26, marginTop: 6 }}>
                    {fastest?.bestActivity ? formatTime(fastest.bestActivity.moving_time) : "—"}
                  </p>
                  <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
                    {fastest?.city ?? "—"}
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Pace médio</p>
                  <p className="ba-value" style={{ fontSize: 26, marginTop: 6 }}>
                    {formatAvgPace(avgPaceSeconds)}
                  </p>
                  <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>melhor por capital</p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Conclusão estimada</p>
                  <p className="ba-value ba-value--accent" style={{ fontSize: 26, marginTop: 6 }}>
                    {remaining > 0 ? estimatedYear : "Concluído!"}
                  </p>
                  <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
                    {remaining > 0 ? `${remaining} restantes · 4/ano` : "🎉"}
                  </p>
                </div>
              </div>

              <div className="ba-progress" style={{ marginTop: 14 }}>
                <div className="ba-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="capitals-panel" style={styles.nextPanel}>
              <p className="ba-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
                Próximas missões
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {next.length > 0 ? (
                  nextByDate.map((capital) => {
                    const raceLabel = getRaceLabel(capital);

                    return (
                      <div key={capital.city} style={styles.nextMissionCard}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            alignItems: "start",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <h3
                              style={{
                                color: "#fff",
                                fontSize: 19,
                                fontWeight: 900,
                                lineHeight: 1.05,
                              }}
                            >
                              {capital.city}{" "}
                              <span style={{ color: "rgba(255,255,255,0.38)" }}>
                                {capital.state}
                              </span>
                            </h3>
                            <p className="ba-muted" style={{ fontSize: 12, marginTop: 5 }}>
                              {getDateLabel(capital)}
                            </p>
                          </div>

                          <span className="capitals-status-pill" style={getStatusPillStyle(capital.status)}>
                            {getStatusLabel(capital.status)}
                          </span>
                        </div>

                        <p
                          className="ba-muted"
                          title={raceLabel}
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            lineHeight: 1.45,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {raceLabel}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p style={styles.rule}>Nenhuma próxima missão confirmada no momento.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="capitals-content" style={styles.content}>
        <section style={{ marginTop: "2rem" }}>
          <CapitalMedalGrid items={challenge} />
        </section>

        <section style={{ marginTop: "2rem" }}>
          <CapitalsBrazilMap items={mapItems} />
        </section>

        {rankedCompleted.length > 0 && (
          <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
            <p className="ba-eyebrow">Performance</p>
            <h2 style={styles.sectionTitle}>Ranking das capitais</h2>
            <p className="ba-muted" style={{ marginTop: ".4rem", marginBottom: "1.25rem" }}>
              Melhor resultado em cada capital, do mais rápido ao mais lento.
            </p>

            <div className="capitals-table-wrap">
              <table className="dark-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Capital</th>
                    <th>Prova</th>
                    <th>Tempo</th>
                    <th>Pace</th>
                    <th>FC média</th>
                    <th style={{ textAlign: "right" }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedCompleted.map((capital, idx) => {
                    const act = capital.bestActivity!;
                    const isFastest = idx === 0;
                    const isSlowest = capital.city === slowest?.city;
                    return (
                      <tr key={capital.city}>
                        <td>
                          <strong style={{ color: isFastest ? "var(--accent)" : "rgba(255,255,255,0.35)", fontWeight: 800 }}>
                            {idx + 1}
                          </strong>
                        </td>
                        <td>
                          <strong style={{ color: "#fff", fontWeight: 800 }}>
                            {capital.city}{" "}
                            <span style={{ color: "rgba(255,255,255,0.38)" }}>{capital.state}</span>
                          </strong>
                          {capital.otherHalfMarathons.length > 0 && (
                            <span className="badge badge--muted" style={{ marginLeft: 6 }}>
                              +{capital.otherHalfMarathons.length}
                            </span>
                          )}
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
                          {cleanActivityName(act.name)}
                        </td>
                        <td>
                          <strong style={{ color: isFastest ? "var(--accent)" : isSlowest ? "rgba(239,68,68,0.85)" : "#fff", fontWeight: 800 }}>
                            {formatTime(act.moving_time)}
                          </strong>
                        </td>
                        <td>{formatPace(act.distance, act.moving_time)}</td>
                        <td>{act.average_heartrate ? `${act.average_heartrate.toFixed(0)} bpm` : "—"}</td>
                        <td style={{ textAlign: "right", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                          {formatDateBR(act.start_date_local)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="capitals-mobile-list">
              {rankedCompleted.map((capital, idx) => {
                const act = capital.bestActivity!;
                const isFastest = idx === 0;
                const isSlowest = capital.city === slowest?.city;

                return (
                  <article key={capital.city} className="capitals-mobile-card" style={getMobileCardToneStyle("completed")}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p className="ba-eyebrow" style={{ fontSize: 10 }}>
                          #{idx + 1}
                        </p>
                        <h3
                          style={{
                            marginTop: 6,
                            color: "#fff",
                            fontSize: 18,
                            fontWeight: 900,
                            lineHeight: 1.08,
                          }}
                        >
                          {capital.city}{" "}
                          <span style={{ color: "rgba(255,255,255,0.38)" }}>
                            {capital.state}
                          </span>
                        </h3>
                      </div>

                      {capital.otherHalfMarathons.length > 0 && (
                        <span className="badge badge--muted">
                          +{capital.otherHalfMarathons.length}
                        </span>
                      )}
                    </div>

                    <p
                      className="ba-muted"
                      title={cleanActivityName(act.name)}
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {cleanActivityName(act.name)}
                    </p>

                    <div className="capitals-mobile-metrics">
                      <MetricBox
                        label="Tempo"
                        value={formatTime(act.moving_time)}
                        tone={isFastest ? "accent" : isSlowest ? "red" : undefined}
                      />
                      <MetricBox label="Pace" value={formatPace(act.distance, act.moving_time)} />
                      <MetricBox
                        label="FC média"
                        value={act.average_heartrate ? `${act.average_heartrate.toFixed(0)} bpm` : "—"}
                      />
                      <MetricBox label="Data" value={formatDateBR(act.start_date_local)} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
          <p className="ba-eyebrow">Mapa mental do projeto</p>
          <h2 style={styles.sectionTitle}>As 27 capitais</h2>

          <div className="capitals-table-wrap">
            <table className="dark-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Capital</th>
                  <th>Principais meias</th>
                  <th>Região</th>
                  <th>Tempo</th>
                  <th>Pace</th>
                  <th>Distância</th>
                  <th>Data</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>

              <tbody>
                {capitalRows.map((capital) => {
                  const activity = capital.bestActivity;
                  const raceLabel = getRaceLabel(capital);
                  const cellToneStyle = getTableCellToneStyle(capital.status);

                  return (
                    <tr key={capital.city}>
                      <td style={cellToneStyle}>
                        <strong style={{ color: "#fff", fontWeight: 800 }}>
                          {capital.city}{" "}
                          <span style={{ color: "rgba(255,255,255,0.38)" }}>
                            {capital.state}
                          </span>
                        </strong>
                        {capital.otherHalfMarathons.length > 0 && (
                          <span className="badge badge--muted" style={{ marginLeft: 6 }}>
                            +{capital.otherHalfMarathons.length}
                          </span>
                        )}
                      </td>
                      <td title={raceLabel} style={cellToneStyle}>
                        <span
                          style={{
                            display: "block",
                            maxWidth: 440,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {raceLabel}
                        </span>
                      </td>
                      <td style={cellToneStyle}>{capital.region}</td>
                      <td style={cellToneStyle}>
                        <strong style={{ color: "#fff", fontWeight: 800 }}>
                          {activity ? formatTime(activity.moving_time) : "—"}
                        </strong>
                      </td>
                      <td style={cellToneStyle}>{activity ? formatPace(activity.distance, activity.moving_time) : "—"}</td>
                      <td style={cellToneStyle}>{activity ? formatDistance(activity.distance) : "—"}</td>
                      <td style={cellToneStyle}>{getDateLabel(capital)}</td>
                      <td
                        style={{
                          ...cellToneStyle,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="capitals-status-pill" style={getStatusPillStyle(capital.status)}>
                          {getStatusLabel(capital.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="capitals-mobile-list">
            {capitalRows.map((capital) => {
              const activity = capital.bestActivity;
              const raceLabel = getRaceLabel(capital);

              return (
                <article
                  key={capital.city}
                  className="capitals-mobile-card"
                  style={getMobileCardToneStyle(capital.status)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          color: "#fff",
                          fontSize: 17,
                          fontWeight: 900,
                          lineHeight: 1.08,
                        }}
                      >
                        {capital.city}{" "}
                        <span style={{ color: "rgba(255,255,255,0.38)" }}>
                          {capital.state}
                        </span>
                      </h3>

                      <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>
                        {capital.region}
                      </p>
                    </div>

                    <span className="capitals-status-pill" style={getStatusPillStyle(capital.status)}>
                      {getStatusLabel(capital.status)}
                    </span>
                  </div>

                  <p
                    className="ba-muted"
                    title={raceLabel}
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {raceLabel}
                  </p>

                  <div className="capitals-mobile-metrics">
                    <MetricBox label="Data" value={getDateLabel(capital)} />
                    <MetricBox label="Tempo" value={activity ? formatTime(activity.moving_time) : "—"} />
                    <MetricBox
                      label="Pace"
                      value={activity ? formatPace(activity.distance, activity.moving_time) : "—"}
                    />
                    <MetricBox
                      label="Distância"
                      value={activity ? formatDistance(activity.distance) : "—"}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
          <p className="ba-eyebrow">Progresso por região</p>

          <div style={styles.regionGrid}>
            {regions.map((region) => {
              const regionCapitals = challenge.filter((capital) => capital.region === region);
              const regionCompleted = regionCapitals.filter(
                (capital) => capital.status === "completed",
              );
              const regionProgress = Math.round(
                (regionCompleted.length / regionCapitals.length) * 100,
              );

              return (
                <div key={region} style={styles.capitalMiniCard}>
                  <p className="ba-muted" style={{ fontSize: 13 }}>
                    {region}
                  </p>

                  <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                    {regionCompleted.length}/{regionCapitals.length}
                  </p>

                  <div className="ba-progress" style={{ marginTop: 12 }}>
                    <div className="ba-progress-fill" style={{ width: `${regionProgress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
          <p className="ba-eyebrow">Regras do desafio</p>

          <div style={{ display: "grid", gap: 10, marginTop: "1rem" }}>
            <p style={styles.rule}>
              A capital só entra como concluída se houver uma corrida de meia maratona no
              Strava próxima à cidade.
            </p>
            <p style={styles.rule}>
              Se houver mais de uma meia na mesma capital, a página exibe automaticamente
              a mais rápida.
            </p>
            <p style={styles.rule}>
              Na tabela, capitais pendentes mostram apenas o mês das principais meias
              mapeadas; a próxima missão mostra a data confirmada.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
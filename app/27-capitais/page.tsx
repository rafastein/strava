export const dynamic = "force-dynamic";

import type { CSSProperties } from "react";
import Navbar from "../components/Navbar";
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

type CapitalRaceCalendarItem = {
  races: string;
  dateLabel: string;
};

const confirmedNextRace: Record<string, CapitalRaceCalendarItem> = {
  GO: {
    races: "Meia Maratona de Goiânia",
    dateLabel: "18/10/2026",
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
  BA: {
    races: "21K Salvador / Maratona Salvador",
    dateLabel: "Abril / Setembro",
  },
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
  PA: {
    races: "Corrida da Amazônia / Meia Maratona da Amazônia",
    dateLabel: "Setembro",
  },
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
  RO: {
    races: "Meia Maratona Internacional de Porto Velho",
    dateLabel: "Agosto",
  },
  RR: { races: "Meia Maratona de Roraima", dateLabel: "Outubro" },
  SC: {
    races:
      "Meia Maratona Internacional de Florianópolis / Maratona de Floripa / SC21K",
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
  if (capital.bestActivity)
    return formatDateBR(capital.bestActivity.start_date_local);
  return getCalendarInfo(capital.state)?.dateLabel ?? "—";
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

function getStatusPillStyle(
  status: CapitalChallengeItem["status"],
): CSSProperties {
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

function getTableCellToneStyle(
  status: CapitalChallengeItem["status"],
): CSSProperties {
  if (status === "completed") {
    return {
      background:
        "linear-gradient(180deg, rgba(16,185,129,0.09), rgba(255,255,255,0.025))",
      borderBottom: "1px solid rgba(16,185,129,0.14)",
    };
  }

  if (status === "next") {
    return {
      background:
        "linear-gradient(180deg, rgba(245,166,35,0.10), rgba(255,255,255,0.03))",
      borderBottom: "1px solid rgba(245,166,35,0.14)",
    };
  }

  return {};
}

function cleanActivityName(name?: string) {
  if (!name) return "Meia maratona identificada";

  return name
    .replace(/^prova:\s*/i, "")
    .replace(/^race:\s*/i, "")
    .trim();
}

function MetricBox({
  label,
  value,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "danger";
  compact?: boolean;
}) {
  const palette = {
    neutral: {
      border: "rgba(255,255,255,0.075)",
      background: "rgba(255,255,255,0.035)",
      value: "#fff",
    },
    accent: {
      border: "rgba(245,166,35,0.23)",
      background: "rgba(245,166,35,0.10)",
      value: "var(--accent)",
    },
    danger: {
      border: "rgba(239,68,68,0.22)",
      background: "rgba(239,68,68,0.10)",
      value: "#ff5d5d",
    },
  }[tone];

  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        padding: compact ? "0.68rem 0.75rem" : "0.85rem 0.9rem",
      }}
    >
      <p className="ba-label" style={{ whiteSpace: "nowrap" }}>
        {label}
      </p>

      <strong
        style={{
          display: "block",
          marginTop: compact ? 5 : 7,
          color: palette.value,
          fontSize: compact ? 14 : 16,
          lineHeight: 1.05,
          fontWeight: 900,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "3rem 1.5rem 2.5rem",
    borderBottom: "1px solid var(--border)",
  },
  heroInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))",
    gap: "2rem",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(3.2rem, 6.5vw, 5.7rem)",
    lineHeight: 0.9,
    letterSpacing: "0.02em",
    color: "var(--text)",
    marginTop: "0.85rem",
    marginBottom: "1rem",
  },
  heroText: {
    maxWidth: 560,
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    lineHeight: 1.7,
  },
  heroCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "1rem",
    alignItems: "stretch",
  },
  heroPanel: {
    borderRadius: 18,
    border: "1px solid rgba(245,166,35,0.18)",
    background:
      "linear-gradient(180deg, rgba(245,166,35,0.08), rgba(255,255,255,0.03))",
    padding: "1.25rem",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
  },
  nextPanel: {
    borderRadius: 18,
    border: "1px solid rgba(245,166,35,0.22)",
    background:
      "linear-gradient(180deg, rgba(245,166,35,0.10), rgba(255,255,255,0.03))",
    padding: "1.25rem",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))",
    gap: 10,
  },
  statCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.075)",
    background: "rgba(0,0,0,0.22)",
    padding: "1rem 1.1rem",
  },
  content: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "1.75rem 1.5rem 4rem",
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
    fontSize: "clamp(2rem, 3.2vw, 3rem)",
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  completedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
    gap: "1rem",
  },
  episodeCard: {
    minWidth: 0,
    borderRadius: 22,
    border: "1px solid rgba(16,185,129,0.22)",
    background:
      "linear-gradient(180deg, rgba(16,185,129,0.09), rgba(255,255,255,0.025))",
    boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
    padding: "1.1rem",
  },
  episodeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "start",
  },
  episodeCity: {
    marginTop: "0.65rem",
    color: "#fff",
    fontSize: 25,
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: "-0.045em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  raceName: {
    marginTop: "0.45rem",
    color: "rgba(255,255,255,0.50)",
    fontSize: 13,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metricSection: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 96px), 1fr))",
    gap: 10,
  },
  secondaryMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 96px), 1fr))",
    gap: 10,
    marginTop: 10,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
    status: capital.bestActivity
      ? "completed"
      : confirmedNextRace[capital.state]
        ? "next"
        : "locked",
  }));

  const completed = challenge.filter(
    (capital) => capital.status === "completed",
  );
  const next = challenge.filter((capital) => capital.status === "next");
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

  return (
    <div className="page capitals-page">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .capitals-mobile-list { display: none; }
            .capitals-table-wrap { margin-top: 1rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .capitals-table-wrap table { min-width: 920px; }

            @media (max-width: 760px) {
              .capitals-page { overflow-x: hidden; }
              .capitals-hero { padding: 2rem 0.95rem 1.45rem !important; }
              .capitals-content { padding: 1.15rem 0.95rem 3rem !important; }
              .capitals-hero-title { font-size: clamp(2.55rem, 15vw, 3.55rem) !important; line-height: 0.94 !important; }
              .capitals-hero-text { max-width: 100% !important; font-size: 14px !important; line-height: 1.6 !important; }
              .capitals-panel { padding: 1rem !important; border-radius: 16px !important; }
              .capitals-stat-card { padding: 0.82rem !important; }
              .capitals-stat-value { font-size: 28px !important; }
              .capitals-section-header { align-items: flex-start !important; flex-direction: column !important; }
              .capitals-section-title { font-size: clamp(1.8rem, 10vw, 2.35rem) !important; line-height: 1.04 !important; }
              .capitals-episode-card { padding: 0.95rem !important; border-radius: 18px !important; }
              .capitals-episode-header { gap: 0.75rem !important; }
              .capitals-episode-city { font-size: 22px !important; white-space: normal !important; }
              .capitals-race-name { white-space: normal !important; display: -webkit-box !important; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
              .capitals-status-pill { height: 20px !important; padding: 0 0.55rem !important; font-size: 8px !important; letter-spacing: 0.1em !important; }
              .capitals-table-wrap { display: none !important; }
              .capitals-mobile-list { display: grid !important; gap: 0.75rem; margin-top: 1rem; }
            }

            @media (max-width: 430px) {
              .capitals-hero { padding-left: 0.85rem !important; padding-right: 0.85rem !important; }
              .capitals-content { padding-left: 0.85rem !important; padding-right: 0.85rem !important; }
              .capitals-metric-grid,
              .capitals-secondary-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
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

            <h1 className="capitals-hero-title" style={styles.heroTitle}>
              Correndo pelas Capitais.
            </h1>

            <p className="capitals-hero-text" style={styles.heroText}>
              Um projeto para correr uma meia maratona em cada uma das 27
              capitais brasileiras. Os dados concluídos vêm do Strava; as
              capitais pendentes mostram o mês das principais meias mapeadas.
            </p>
          </div>

          <div className="capitals-hero-cards" style={styles.heroCards}>
            <div className="capitals-panel" style={styles.heroPanel}>
              <p
                className="ba-eyebrow"
                style={{ fontSize: 10, marginBottom: 12 }}
              >
                Correndo o Brasil
              </p>

              <div className="capitals-stat-grid" style={styles.statGrid}>
                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Capitais concluídas</p>
                  <p
                    className="ba-value capitals-stat-value"
                    style={{ fontSize: 34, marginTop: 6 }}
                  >
                    {completed.length}/27
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Progresso</p>
                  <p
                    className="ba-value ba-value--accent capitals-stat-value"
                    style={{ fontSize: 34, marginTop: 6 }}
                  >
                    {progress}%
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Próximas missões</p>
                  <p
                    className="ba-value capitals-stat-value"
                    style={{ fontSize: 34, marginTop: 6 }}
                  >
                    {next.length}
                  </p>
                </div>

                <div className="capitals-stat-card" style={styles.statCard}>
                  <p className="ba-label">Melhor meia</p>
                  <p
                    className="ba-value capitals-stat-value"
                    style={{ fontSize: 30, marginTop: 6 }}
                  >
                    {fastest?.bestActivity
                      ? formatTime(fastest.bestActivity.moving_time)
                      : "—"}
                  </p>
                  <p
                    className="ba-muted"
                    style={{ marginTop: 5, fontSize: 12 }}
                  >
                    {fastest?.city ?? "Ainda sem dados"}
                  </p>
                </div>
              </div>

              <div className="ba-progress" style={{ marginTop: 14 }}>
                <div
                  className="ba-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="capitals-panel" style={styles.nextPanel}>
              <p
                className="ba-eyebrow"
                style={{ fontSize: 10, marginBottom: 12 }}
              >
                Próximas missões
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {next.length > 0 ? (
                  next.map((capital) => {
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
                            <p
                              className="ba-muted"
                              style={{ fontSize: 12, marginTop: 5 }}
                            >
                              {getDateLabel(capital)}
                            </p>
                          </div>

                          <span
                            className="capitals-status-pill"
                            style={getStatusPillStyle(capital.status)}
                          >
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
                  <p style={styles.rule}>
                    Nenhuma próxima missão confirmada no momento.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="capitals-content" style={styles.content}>
        <section>
          <div className="capitals-section-header" style={styles.sectionHeader}>
            <div>
              <p className="ba-eyebrow">Capitais concluídas</p>
              <h2
                className="capitals-section-title"
                style={styles.sectionTitle}
              >
                Episódios já registrados
              </h2>
            </div>
          </div>

          <div style={styles.completedGrid}>
            {completed.map((capital, index) => {
              const activity = capital.bestActivity;
              const raceName = cleanActivityName(activity?.name);

              return (
                <article
                  key={capital.city}
                  className="capitals-episode-card"
                  style={styles.episodeCard}
                >
                  <div
                    className="capitals-episode-header"
                    style={styles.episodeHeader}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p className="ba-eyebrow" style={{ fontSize: 10 }}>
                        EP {String(index + 1).padStart(2, "0")}
                      </p>

                      <h3
                        className="capitals-episode-city"
                        style={styles.episodeCity}
                      >
                        {capital.city}{" "}
                        <span style={{ color: "rgba(255,255,255,0.38)" }}>
                          {capital.state}
                        </span>
                      </h3>

                      <p
                        className="capitals-race-name"
                        style={styles.raceName}
                        title={raceName}
                      >
                        {raceName}
                      </p>
                    </div>

                    <span
                      className="badge badge--success"
                      style={{ flexShrink: 0 }}
                    >
                      Concluída
                    </span>
                  </div>

                  <div style={styles.metricSection}>
                    <div
                      className="capitals-metric-grid"
                      style={styles.metricGrid}
                    >
                      <MetricBox
                        label="Tempo"
                        value={formatTime(activity?.moving_time)}
                      />
                      <MetricBox
                        label="Pace"
                        value={formatPace(
                          activity?.distance,
                          activity?.moving_time,
                        )}
                      />
                      <MetricBox
                        label="Data"
                        value={formatDateBR(activity?.start_date_local)}
                      />
                    </div>

                    <div
                      className="capitals-secondary-metric-grid"
                      style={styles.secondaryMetricGrid}
                    >
                      <MetricBox
                        label="Distância"
                        value={formatDistance(activity?.distance)}
                        compact
                      />
                      <MetricBox
                        label="Altimetria"
                        value={`${activity?.total_elevation_gain?.toFixed(0) ?? "—"} m`}
                        tone="accent"
                        compact
                      />
                      <MetricBox
                        label="FC Média"
                        value={`${activity?.average_heartrate?.toFixed(0) ?? "—"} bpm`}
                        tone="danger"
                        compact
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="ba-card"
          style={{ ...styles.paddedCard, marginTop: "2rem" }}
        >
          <p className="ba-eyebrow">Mapa mental do projeto</p>
          <h2 className="capitals-section-title" style={styles.sectionTitle}>
            As 27 capitais
          </h2>

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
                      <td style={cellToneStyle}>
                        {activity
                          ? formatPace(activity.distance, activity.moving_time)
                          : "—"}
                      </td>
                      <td style={cellToneStyle}>
                        {activity ? formatDistance(activity.distance) : "—"}
                      </td>
                      <td style={cellToneStyle}>{getDateLabel(capital)}</td>
                      <td
                        style={{
                          ...cellToneStyle,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          className="capitals-status-pill"
                          style={getStatusPillStyle(capital.status)}
                        >
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
              const toneStyle = getTableCellToneStyle(capital.status);

              return (
                <article
                  key={capital.city}
                  style={{
                    ...toneStyle,
                    border: "1px solid rgba(255,255,255,0.075)",
                    borderRadius: 16,
                    padding: "0.95rem",
                    background:
                      capital.status === "completed"
                        ? "linear-gradient(180deg, rgba(16,185,129,0.10), rgba(255,255,255,0.025))"
                        : capital.status === "next"
                          ? "linear-gradient(180deg, rgba(245,166,35,0.12), rgba(255,255,255,0.03))"
                          : "rgba(255,255,255,0.032)",
                  }}
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
                      <strong
                        style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}
                      >
                        {capital.city}{" "}
                        <span style={{ color: "rgba(255,255,255,0.38)" }}>
                          {capital.state}
                        </span>
                      </strong>
                      <p
                        className="ba-muted"
                        style={{ marginTop: 3, fontSize: 12 }}
                      >
                        {capital.region}
                      </p>
                    </div>

                    <span
                      className="capitals-status-pill"
                      style={getStatusPillStyle(capital.status)}
                    >
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <MetricBox
                      label="Data"
                      value={getDateLabel(capital)}
                      compact
                    />
                    <MetricBox
                      label="Tempo"
                      value={activity ? formatTime(activity.moving_time) : "—"}
                      compact
                    />
                    <MetricBox
                      label="Pace"
                      value={
                        activity
                          ? formatPace(activity.distance, activity.moving_time)
                          : "—"
                      }
                      compact
                    />
                    <MetricBox
                      label="Distância"
                      value={activity ? formatDistance(activity.distance) : "—"}
                      compact
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="ba-card"
          style={{ ...styles.paddedCard, marginTop: "2rem" }}
        >
          <p className="ba-eyebrow">Progresso por região</p>

          <div style={styles.regionGrid}>
            {regions.map((region) => {
              const regionCapitals = challenge.filter(
                (capital) => capital.region === region,
              );
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

                  <p
                    className="ba-value capitals-stat-value"
                    style={{ fontSize: 30, marginTop: 6 }}
                  >
                    {regionCompleted.length}/{regionCapitals.length}
                  </p>

                  <div className="ba-progress" style={{ marginTop: 12 }}>
                    <div
                      className="ba-progress-fill"
                      style={{ width: `${regionProgress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="ba-card"
          style={{ ...styles.paddedCard, marginTop: "2rem" }}
        >
          <p className="ba-eyebrow">Regras do desafio</p>

          <div style={{ display: "grid", gap: 10, marginTop: "1rem" }}>
            <p style={styles.rule}>
              A capital só entra como concluída se houver uma corrida de meia
              maratona no Strava próxima à cidade.
            </p>
            <p style={styles.rule}>
              Se houver mais de uma meia na mesma capital, a página exibe
              automaticamente a mais rápida.
            </p>
            <p style={styles.rule}>
              Na tabela, capitais pendentes mostram apenas o mês das principais
              meias mapeadas; a próxima missão mostra a data confirmada.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

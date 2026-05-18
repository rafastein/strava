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
    padding: "3rem 1.5rem 2.5rem",
    borderBottom: "1px solid var(--border)",
  },
  heroInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(460px, 1.1fr)",
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
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(260px, 0.9fr)",
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
    status: capital.bestActivity ? "completed" : confirmedNextRace[capital.state] ? "next" : "locked",
  }));

  const completed = challenge.filter((capital) => capital.status === "completed");
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

  return (
    <div className="page">
      <Navbar
        athleteName={athlete?.firstname ?? undefined}
        athleteAvatar={athlete?.profile_medium ?? undefined}
      />

      <section style={styles.hero}>
        <div className="home-hero__glow-1" />
        <div className="home-hero__glow-2" />

        <div style={styles.heroInner}>
          <div>
            <p className="ba-eyebrow">Projeto 27 capitais</p>

            <h1 style={styles.heroTitle}>Correndo pelas Capitais.</h1>

            <p style={styles.heroText}>
              Um projeto para correr uma meia maratona em cada uma das 27 capitais
              brasileiras. Os dados concluídos vêm do Strava; as capitais pendentes
              mostram o mês das principais meias mapeadas.
            </p>
          </div>

          <div style={styles.heroCards}>
            <div style={styles.heroPanel}>
              <p className="ba-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
                Correndo o Brasil
              </p>

              <div style={{ ...styles.statGrid, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <div style={styles.statCard}>
                  <p className="ba-label">Concluídas</p>
                  <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                    {completed.length}/27
                  </p>
                </div>

                <div style={styles.statCard}>
                  <p className="ba-label">Progresso</p>
                  <p className="ba-value ba-value--accent" style={{ fontSize: 30, marginTop: 6 }}>
                    {progress}%
                  </p>
                </div>

                <div style={styles.statCard}>
                  <p className="ba-label">Km acumulado</p>
                  <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                    {totalKm.toFixed(0)} km
                  </p>
                </div>

                <div style={styles.statCard}>
                  <p className="ba-label">Melhor meia</p>
                  <p className="ba-value" style={{ fontSize: 26, marginTop: 6 }}>
                    {fastest?.bestActivity ? formatTime(fastest.bestActivity.moving_time) : "—"}
                  </p>
                  <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
                    {fastest?.city ?? "—"}
                  </p>
                </div>

                <div style={styles.statCard}>
                  <p className="ba-label">Pace médio</p>
                  <p className="ba-value" style={{ fontSize: 26, marginTop: 6 }}>
                    {formatAvgPace(avgPaceSeconds)}
                  </p>
                  <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>melhor por capital</p>
                </div>

                <div style={styles.statCard}>
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

            <div style={styles.nextPanel}>
              <p className="ba-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
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
                            <p className="ba-muted" style={{ fontSize: 12, marginTop: 5 }}>
                              {getDateLabel(capital)}
                            </p>
                          </div>

                          <span style={getStatusPillStyle(capital.status)}>
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

      <main style={styles.content}>
        {rankedCompleted.length > 0 && (
          <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
            <p className="ba-eyebrow">Performance</p>
            <h2 style={styles.sectionTitle}>Ranking das capitais</h2>
            <p className="ba-muted" style={{ marginTop: ".4rem", marginBottom: "1.25rem" }}>
              Melhor resultado em cada capital, do mais rápido ao mais lento.
            </p>

            <div style={{ overflowX: "auto" }}>
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
          </section>
        )}

        <section className="ba-card" style={{ ...styles.paddedCard, marginTop: "2rem" }}>
          <p className="ba-eyebrow">Mapa mental do projeto</p>
          <h2 style={styles.sectionTitle}>As 27 capitais</h2>

          <div style={{ marginTop: "1rem", overflowX: "auto" }}>
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
                        <span style={getStatusPillStyle(capital.status)}>
                          {getStatusLabel(capital.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
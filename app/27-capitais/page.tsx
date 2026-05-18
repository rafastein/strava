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

function getStatusClasses(status: CapitalChallengeItem["status"]) {
  if (status === "completed") return "badge badge--success";
  if (status === "next") return "badge badge--accent";
  return "badge badge--muted";
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
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(360px, 0.95fr)",
    gap: "2rem",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(3.4rem, 7vw, 6rem)",
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
  heroPanel: {
    borderRadius: 18,
    border: "1px solid rgba(245,166,35,0.18)",
    background: "linear-gradient(180deg, rgba(245,166,35,0.08), rgba(255,255,255,0.03))",
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
  completedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
    gap: "1rem",
  },
  episodeCard: {
    minWidth: 0,
    borderRadius: 22,
    border: "1px solid rgba(16,185,129,0.22)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.09), rgba(255,255,255,0.025))",
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
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  secondaryMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 10,
  },
  lowerGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 390px)",
    gap: "1rem",
    alignItems: "start",
    marginTop: "2rem",
  },
  paddedCard: {
    padding: "1.25rem",
  },
  capitalGrid: {
    marginTop: "1rem",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))",
    gap: 10,
  },
  capitalMiniCard: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "0.85rem",
    minHeight: 82,
  },
  sidebarStack: {
    display: "grid",
    gap: "1rem",
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

  const challenge = buildCapitalChallenge(activities);
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

            <h1 style={styles.heroTitle}>Uma capital por vez.</h1>

            <p style={styles.heroText}>
              Um projeto para correr uma meia maratona em cada uma das 27 capitais
              brasileiras. Os dados são puxados automaticamente do Strava e, quando
              há mais de uma meia na mesma capital, a página exibe a mais rápida.
            </p>
          </div>

          <div style={styles.heroPanel}>
            <p className="ba-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
              Correndo o Brasil
            </p>

            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <p className="ba-label">Capitais concluídas</p>
                <p className="ba-value" style={{ fontSize: 34, marginTop: 6 }}>
                  {completed.length}/27
                </p>
              </div>

              <div style={styles.statCard}>
                <p className="ba-label">Progresso</p>
                <p className="ba-value ba-value--accent" style={{ fontSize: 34, marginTop: 6 }}>
                  {progress}%
                </p>
              </div>

              <div style={styles.statCard}>
                <p className="ba-label">Próximas missões</p>
                <p className="ba-value" style={{ fontSize: 34, marginTop: 6 }}>
                  {next.length}
                </p>
              </div>

              <div style={styles.statCard}>
                <p className="ba-label">Melhor meia</p>
                <p className="ba-value" style={{ fontSize: 30, marginTop: 6 }}>
                  {fastest?.bestActivity
                    ? formatTime(fastest.bestActivity.moving_time)
                    : "—"}
                </p>
                <p className="ba-muted" style={{ marginTop: 5, fontSize: 12 }}>
                  {fastest?.city ?? "Ainda sem dados"}
                </p>
              </div>
            </div>

            <div className="ba-progress" style={{ marginTop: 14 }}>
              <div className="ba-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <main style={styles.content}>
        <section>
          <div style={styles.sectionHeader}>
            <div>
              <p className="ba-eyebrow">Capitais concluídas</p>
              <h2 style={styles.sectionTitle}>Episódios já registrados</h2>
            </div>
          </div>

          <div style={styles.completedGrid}>
            {completed.map((capital, index) => {
              const activity = capital.bestActivity;
              const raceName = cleanActivityName(activity?.name);

              return (
                <article key={capital.city} style={styles.episodeCard}>
                  <div style={styles.episodeHeader}>
                    <div style={{ minWidth: 0 }}>
                      <p className="ba-eyebrow" style={{ fontSize: 10 }}>
                        EP {String(index + 1).padStart(2, "0")}
                      </p>

                      <h3 style={styles.episodeCity}>
                        {capital.city}{" "}
                        <span style={{ color: "rgba(255,255,255,0.38)" }}>
                          {capital.state}
                        </span>
                      </h3>

                      <p style={styles.raceName} title={raceName}>
                        {raceName}
                      </p>
                    </div>

                    <span className="badge badge--success" style={{ flexShrink: 0 }}>
                      Concluída
                    </span>
                  </div>

                  <div style={styles.metricSection}>
                    <div style={styles.metricGrid}>
                      <MetricBox label="Tempo" value={formatTime(activity?.moving_time)} />
                      <MetricBox
                        label="Pace"
                        value={formatPace(activity?.distance, activity?.moving_time)}
                      />
                      <MetricBox label="Data" value={formatDateBR(activity?.start_date_local)} />
                    </div>

                    <div style={styles.secondaryMetricGrid}>
                      <MetricBox label="Distância" value={formatDistance(activity?.distance)} compact />
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

        <section style={styles.lowerGrid}>
          <div className="ba-card" style={styles.paddedCard}>
            <p className="ba-eyebrow">Mapa mental do projeto</p>
            <h2 style={styles.sectionTitle}>As 27 capitais</h2>

            <div style={styles.capitalGrid}>
              {challenge.map((capital) => {
                const activity = capital.bestActivity;

                return (
                  <div key={capital.city} style={styles.capitalMiniCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {capital.city}{" "}
                          <span style={{ color: "rgba(255,255,255,0.36)" }}>
                            {capital.state}
                          </span>
                        </h3>
                        <p className="ba-muted" style={{ fontSize: 12, marginTop: 3 }}>
                          {capital.region}
                        </p>
                      </div>

                      <span className={getStatusClasses(capital.status)} style={{ flexShrink: 0 }}>
                        {getStatusLabel(capital.status)}
                      </span>
                    </div>

                    {activity && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                        <div>
                          <p className="ba-label">Tempo</p>
                          <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, marginTop: 3 }}>
                            {formatTime(activity.moving_time)}
                          </p>
                        </div>
                        <div>
                          <p className="ba-label">Pace</p>
                          <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, marginTop: 3 }}>
                            {formatPace(activity.distance, activity.moving_time)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside style={styles.sidebarStack}>
            <div className="ba-card ba-card--accent" style={styles.paddedCard}>
              <p className="ba-eyebrow">Próximas missões</p>

              <div style={{ display: "grid", gap: 10, marginTop: "1rem" }}>
                {next.map((capital) => (
                  <div key={capital.city} style={styles.capitalMiniCard}>
                    <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: 1.05 }}>
                      {capital.city}{" "}
                      <span style={{ color: "rgba(255,255,255,0.38)" }}>{capital.state}</span>
                    </h3>
                    <p className="ba-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {capital.region}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ba-card" style={styles.paddedCard}>
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
                  Distância considerada: entre 20,5 km e 22,7 km.
                </p>
              </div>
            </div>
          </aside>
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
      </main>
    </div>
  );
}

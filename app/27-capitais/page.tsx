export const dynamic = "force-dynamic";

import Link from "next/link";

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

const STRAVA_AFTER_EPOCH = Math.floor(new Date("2024-01-01T00:00:00Z").getTime() / 1000);

const regions = ["Centro-Oeste", "Sudeste", "Sul", "Nordeste", "Norte"];

async function getStravaActivities() {
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return [];

    const allActivities: StravaActivity[] = [];
    const perPage = 200;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL("https://www.strava.com/api/v3/athlete/activities");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      url.searchParams.set("after", String(STRAVA_AFTER_EPOCH));

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) break;

      const data = (await response.json()) as StravaActivity[];
      if (!Array.isArray(data) || data.length === 0) break;

      allActivities.push(...data);

      if (data.length < perPage) break;
    }

    return allActivities;
  } catch {
    return [];
  }
}

function statusBadgeClass(status: CapitalChallengeItem["status"]) {
  if (status === "completed") return "badge badge--success";
  if (status === "next") return "badge badge--accent";
  return "badge badge--muted";
}

function statusCardClass(status: CapitalChallengeItem["status"]) {
  if (status === "completed") return "ba-card capital-card capital-card--done";
  if (status === "next") return "ba-card capital-card capital-card--next";
  return "ba-card-soft capital-card";
}

function completedCardSubline(capital: CapitalChallengeItem) {
  const total = capital.otherHalfMarathons.length + (capital.bestActivity ? 1 : 0);
  if (total <= 1) return "Melhor meia identificada pelo Strava";
  return `${total} meias nessa capital · exibindo a mais rápida`;
}

export default async function CapitaisPage() {
  const activities = await getStravaActivities();
  const challenge = buildCapitalChallenge(activities);

  const completed = challenge.filter((capital) => capital.status === "completed");
  const next = challenge.filter((capital) => capital.status === "next");
  const progress = Math.round((completed.length / capitals.length) * 100);

  const fastest = [...completed]
    .filter((capital) => capital.bestActivity)
    .sort((a, b) => (a.bestActivity?.moving_time ?? Infinity) - (b.bestActivity?.moving_time ?? Infinity))[0];

  return (
    <main className="page capital-challenge-page">
      <Navbar />

      <div className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Projeto 27 Capitais</p>
            <h1 className="ba-title">Correndo o Brasil, uma capital por vez</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem", maxWidth: 760 }}>
              Um desafio para correr uma meia maratona em cada capital brasileira. Os dados vêm do
              Strava e, quando há mais de uma meia na mesma capital, a página considera
              automaticamente a mais rápida.
            </p>
          </div>

          <Link href="/" className="ba-back">
            ← Voltar ao dashboard
          </Link>
        </div>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: "3rem" }}>
          <div className="ba-card" style={{ padding: "1.25rem 1.4rem" }}>
            <p className="ba-label">Capitais concluídas</p>
            <h2 className="ba-value card__value--success" style={{ marginTop: ".45rem" }}>
              {completed.length}/27
            </h2>
            <p className="ba-muted" style={{ marginTop: ".35rem" }}>
              passaporte nacional
            </p>
          </div>

          <div className="ba-card" style={{ padding: "1.25rem 1.4rem" }}>
            <p className="ba-label">Progresso geral</p>
            <h2 className="ba-value card__value--accent" style={{ marginTop: ".45rem" }}>
              {progress}%
            </h2>
            <div className="progress-bar" style={{ marginTop: ".8rem" }}>
              <div className="ba-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="ba-card" style={{ padding: "1.25rem 1.4rem" }}>
            <p className="ba-label">Próximas missões</p>
            <h2 className="ba-value" style={{ marginTop: ".45rem" }}>
              {next.length}
            </h2>
            <p className="ba-muted" style={{ marginTop: ".35rem" }}>
              Sul no radar
            </p>
          </div>

          <div className="ba-card" style={{ padding: "1.25rem 1.4rem" }}>
            <p className="ba-label">Melhor meia</p>
            <h2 className="ba-value card__value--blue" style={{ marginTop: ".45rem" }}>
              {fastest?.bestActivity ? formatTime(fastest.bestActivity.moving_time) : "—"}
            </h2>
            <p className="ba-muted" style={{ marginTop: ".35rem" }}>
              {fastest?.city ?? "aguardando Strava"}
            </p>
          </div>
        </section>

        {completed.length > 0 && (
          <section style={{ marginBottom: "3.5rem" }}>
            <div className="ba-section-head" style={{ marginBottom: "1rem" }}>
              <div>
                <p className="ba-eyebrow ba-section">Capitais concluídas</p>
                <h2 className="text-2xl font-semibold text-white/90">Episódios já registrados</h2>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {completed.map((capital, index) => {
                const activity = capital.bestActivity;

                return (
                  <article key={capital.city} className="card card--success" style={{ padding: "1.35rem" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="ba-eyebrow">EP {String(index + 1).padStart(2, "0")}</p>
                        <h3 className="mt-2 text-xl font-semibold text-white/95">
                          {capital.city} <span className="text-white/40">{capital.state}</span>
                        </h3>
                        <p className="mt-2 text-sm text-white/45">{activity?.name ?? "Meia identificada no Strava"}</p>
                      </div>
                      <span className="badge badge--success">Concluída</span>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="ba-card-soft" style={{ padding: ".75rem" }}>
                        <p className="ba-label">Tempo</p>
                        <p className="mt-1 text-sm font-semibold text-white/90">{formatTime(activity?.moving_time)}</p>
                      </div>
                      <div className="ba-card-soft" style={{ padding: ".75rem" }}>
                        <p className="ba-label">Pace</p>
                        <p className="mt-1 text-sm font-semibold text-white/90">
                          {formatPace(activity?.distance, activity?.moving_time)}
                        </p>
                      </div>
                      <div className="ba-card-soft" style={{ padding: ".75rem" }}>
                        <p className="ba-label">Data</p>
                        <p className="mt-1 text-sm font-semibold text-white/90">
                          {formatDateBR(activity?.start_date_local)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <span className="badge badge--muted">{formatDistance(activity?.distance)}</span>
                      <span className="badge badge--accent">{activity?.total_elevation_gain?.toFixed(0) ?? "—"} m</span>
                      <span className="badge badge--danger">{activity?.average_heartrate?.toFixed(0) ?? "—"} bpm</span>
                    </div>

                    <p className="ba-muted" style={{ marginTop: "1rem" }}>
                      {completedCardSubline(capital)}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]" style={{ marginBottom: "3.5rem" }}>
          <div className="ba-card" style={{ padding: "1.5rem" }}>
            <div className="ba-section-head" style={{ marginBottom: "1.2rem" }}>
              <div>
                <p className="ba-eyebrow ba-section">Mapa mental do projeto</p>
                <h2 className="text-2xl font-semibold text-white/90">As 27 capitais</h2>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {challenge.map((capital) => {
                const activity = capital.bestActivity;

                return (
                  <div key={capital.city} className={statusCardClass(capital.status)} style={{ padding: "1rem" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white/90">
                          {capital.city} <span className="text-white/40">{capital.state}</span>
                        </h3>
                        <p className="mt-1 text-xs text-white/40">{capital.region}</p>
                      </div>
                      <span className={statusBadgeClass(capital.status)}>{getStatusLabel(capital.status)}</span>
                    </div>

                    {activity && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div>
                          <p className="ba-label">Tempo</p>
                          <p className="mt-1 text-xs font-semibold text-white/85">{formatTime(activity.moving_time)}</p>
                        </div>
                        <div>
                          <p className="ba-label">Pace</p>
                          <p className="mt-1 text-xs font-semibold text-white/85">
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

          <aside className="space-y-6">
            <div className="card card--accent" style={{ padding: "1.4rem" }}>
              <p className="ba-eyebrow ba-section">Próximas missões</p>
              <div className="mt-5 space-y-3">
                {next.map((capital) => (
                  <div key={capital.city} className="ba-card-soft" style={{ padding: "1rem" }}>
                    <h3 className="text-lg font-semibold text-white/95">
                      {capital.city} <span className="text-white/40">{capital.state}</span>
                    </h3>
                    <p className="mt-1 text-sm text-white/45">{capital.region}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ba-card" style={{ padding: "1.4rem" }}>
              <p className="ba-eyebrow ba-section">Regras do desafio</p>
              <div className="mt-5 space-y-3 text-sm text-white/60">
                <p className="ba-card-soft" style={{ padding: "1rem" }}>
                  A capital só entra como concluída se houver uma corrida de meia maratona no Strava
                  próxima à cidade.
                </p>
                <p className="ba-card-soft" style={{ padding: "1rem" }}>
                  Se houver mais de uma meia na mesma capital, a página exibe a mais rápida.
                </p>
                <p className="ba-card-soft" style={{ padding: "1rem" }}>
                  Distância considerada: entre 20,5 km e 22,7 km.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow ba-section">Progresso por região</p>
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {regions.map((region) => {
              const regionCapitals = challenge.filter((capital) => capital.region === region);
              const regionCompleted = regionCapitals.filter((capital) => capital.status === "completed");
              const regionProgress = Math.round((regionCompleted.length / regionCapitals.length) * 100);

              return (
                <div key={region} className="ba-card-soft" style={{ padding: "1rem" }}>
                  <p className="ba-label">{region}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white/90">
                    {regionCompleted.length}/{regionCapitals.length}
                  </h3>
                  <div className="progress-bar" style={{ marginTop: ".8rem" }}>
                    <div className="ba-progress-fill" style={{ width: `${regionProgress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

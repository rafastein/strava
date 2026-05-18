export const dynamic = "force-dynamic";

import Link from "next/link";
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

async function getStravaActivities() {
  const token = await getValidStravaAccessToken();
  const allActivities: StravaActivity[] = [];

  for (let page = 1; page <= 10; page++) {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) break;

    const data = (await response.json()) as StravaActivity[];
    allActivities.push(...data);

    if (data.length < 200) break;
  }

  return allActivities;
}

function getStatusClasses(status: CapitalChallengeItem["status"]) {
  if (status === "completed") {
    return "border-emerald-400/30 bg-emerald-400/10";
  }

  if (status === "next") {
    return "border-orange-400/40 bg-orange-500/10";
  }

  return "border-white/10 bg-white/[0.03]";
}

function getStatusPillClasses(status: CapitalChallengeItem["status"]) {
  if (status === "completed") {
    return "bg-emerald-400/20 text-emerald-200";
  }

  if (status === "next") {
    return "bg-orange-400/20 text-orange-200";
  }

  return "bg-white/10 text-white/40";
}

export default async function CapitaisPage() {
  const activities = await getStravaActivities();
  const challenge = buildCapitalChallenge(activities);

  const completed = challenge.filter((capital) => capital.status === "completed");
  const next = challenge.filter((capital) => capital.status === "next");
  const progress = Math.round((completed.length / capitals.length) * 100);

  const regions = ["Centro-Oeste", "Sudeste", "Sul", "Nordeste", "Norte"];

  const fastest = [...completed]
    .filter((capital) => capital.bestActivity)
    .sort((a, b) => {
      return (a.bestActivity?.moving_time ?? Infinity) - (b.bestActivity?.moving_time ?? Infinity);
    })[0];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 md:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-orange-400/60 hover:text-white"
          >
            ← Voltar
          </Link>

          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-200">
            Projeto 27 Capitais
          </span>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.28),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6 shadow-2xl md:p-10">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
              Correndo o Brasil
            </p>

            <h1 className="text-4xl font-black tracking-tight md:text-6xl">
              Uma capital por vez.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
              Um projeto para correr uma meia maratona em cada uma das 27 capitais
              brasileiras. Os dados são puxados do Strava e, quando há mais de uma
              meia na mesma capital, entra automaticamente a mais rápida.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/50">Capitais concluídas</p>
                <strong className="mt-2 block text-4xl">{completed.length}/27</strong>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/50">Progresso</p>
                <strong className="mt-2 block text-4xl">{progress}%</strong>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/50">Próximas missões</p>
                <strong className="mt-2 block text-4xl">{next.length}</strong>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm text-white/50">Melhor meia</p>
                <strong className="mt-2 block text-2xl">
                  {fastest?.bestActivity ? formatTime(fastest.bestActivity.moving_time) : "—"}
                </strong>
                <p className="mt-1 text-xs text-white/40">{fastest?.city ?? "Ainda sem dados"}</p>
              </div>
            </div>

            <div className="mt-7 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-orange-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {completed.length > 0 && (
          <section className="grid gap-4 md:grid-cols-3">
            {completed.map((capital, index) => {
              const activity = capital.bestActivity;

              return (
                <article
                  key={capital.city}
                  className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-300">
                      EP {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">
                      Concluída
                    </span>
                  </div>

                  <h2 className="text-2xl font-black">
                    {capital.city} <span className="text-white/40">{capital.state}</span>
                  </h2>

                  <p className="mt-1 line-clamp-1 text-sm text-white/50">
                    {activity?.name ?? "Meia maratona identificada no Strava"}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-white/40">Tempo</p>
                      <strong>{formatTime(activity?.moving_time)}</strong>
                    </div>

                    <div>
                      <p className="text-white/40">Pace</p>
                      <strong>{formatPace(activity?.distance, activity?.moving_time)}</strong>
                    </div>

                    <div>
                      <p className="text-white/40">Data</p>
                      <strong>{formatDateBR(activity?.start_date_local)}</strong>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-black/25 p-4 text-sm text-white/70">
                    <div className="flex items-center justify-between gap-3">
                      <span>Distância</span>
                      <strong>{formatDistance(activity?.distance)}</strong>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Altimetria</span>
                      <strong>{activity?.total_elevation_gain?.toFixed(0) ?? "—"} m</strong>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>FC média</span>
                      <strong>{activity?.average_heartrate?.toFixed(0) ?? "—"} bpm</strong>
                    </div>

                    {capital.otherHalfMarathons.length > 0 && (
                      <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/40">
                        + {capital.otherHalfMarathons.length} meia(s) nessa capital. Exibindo a
                        mais rápida.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
                Mapa mental do projeto
              </p>
              <h2 className="mt-2 text-3xl font-black">As 27 capitais</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {challenge.map((capital) => {
                const activity = capital.bestActivity;

                return (
                  <div
                    key={capital.city}
                    className={[
                      "rounded-2xl border p-4 transition",
                      getStatusClasses(capital.status),
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">
                          {capital.city}{" "}
                          <span className="text-sm text-white/40">{capital.state}</span>
                        </h3>
                        <p className="mt-1 text-xs text-white/40">{capital.region}</p>
                      </div>

                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                          getStatusPillClasses(capital.status),
                        ].join(" ")}
                      >
                        {getStatusLabel(capital.status)}
                      </span>
                    </div>

                    {activity && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/60">
                        <div>
                          <p className="text-white/35">Tempo</p>
                          <strong className="text-white/80">{formatTime(activity.moving_time)}</strong>
                        </div>

                        <div>
                          <p className="text-white/35">Pace</p>
                          <strong className="text-white/80">
                            {formatPace(activity.distance, activity.moving_time)}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-orange-400/20 bg-orange-500/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
                Próximas missões
              </p>

              <div className="mt-5 space-y-3">
                {next.map((capital) => (
                  <div
                    key={capital.city}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <h3 className="text-xl font-black">
                      {capital.city}{" "}
                      <span className="text-white/40">{capital.state}</span>
                    </h3>
                    <p className="mt-1 text-sm text-white/50">{capital.region}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
                Regras do desafio
              </p>

              <div className="mt-5 space-y-3 text-sm text-white/65">
                <p className="rounded-2xl bg-black/20 p-4">
                  A capital só entra como concluída se houver uma corrida de meia maratona no
                  Strava próxima à cidade.
                </p>

                <p className="rounded-2xl bg-black/20 p-4">
                  Se houver mais de uma meia na mesma capital, a página exibe automaticamente a
                  mais rápida.
                </p>

                <p className="rounded-2xl bg-black/20 p-4">
                  Distância considerada: entre 20,5 km e 22,7 km. A lógica prioriza atividades
                  com nome de prova ou meia maratona quando houver esse tipo de registro.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
            Progresso por região
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {regions.map((region) => {
              const regionCapitals = challenge.filter((capital) => capital.region === region);
              const regionCompleted = regionCapitals.filter(
                (capital) => capital.status === "completed",
              );

              const regionProgress = Math.round(
                (regionCompleted.length / regionCapitals.length) * 100,
              );

              return (
                <div key={region} className="rounded-2xl bg-black/20 p-4">
                  <p className="text-sm text-white/50">{region}</p>

                  <strong className="mt-2 block text-2xl">
                    {regionCompleted.length}/{regionCapitals.length}
                  </strong>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${regionProgress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";

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

async function getStravaActivities() {
  const token = await getValidStravaAccessToken();
  const allActivities: StravaActivity[] = [];

  for (let page = 1; page <= 5; page++) {
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

function cleanActivityName(name?: string) {
  if (!name) return "Meia maratona identificada";

  return name
    .replace(/^prova:\s*/i, "")
    .replace(/^corrida:\s*/i, "")
    .trim();
}

function getStatusClasses(status: CapitalChallengeItem["status"]) {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10";
  if (status === "next") return "border-orange-400/40 bg-orange-500/10";
  return "border-white/10 bg-white/[0.03]";
}

function getStatusPillClasses(status: CapitalChallengeItem["status"]) {
  if (status === "completed") return "bg-emerald-400/20 text-emerald-200";
  if (status === "next") return "bg-orange-400/20 text-orange-200";
  return "bg-white/10 text-white/40";
}

function MetricBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "amber" | "red";
}) {
  const toneClasses = {
    neutral: "border-white/10 bg-black/25 text-white",
    amber: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
  }[tone];

  const labelClasses = {
    neutral: "text-white/40",
    amber: "text-amber-100/65",
    red: "text-red-100/65",
  }[tone];

  return (
    <div className={["min-w-0 rounded-2xl border p-3", toneClasses].join(" ")}>
      <p className={["truncate text-[10px] font-black uppercase tracking-[0.16em]", labelClasses].join(" ")}>
        {label}
      </p>

      <strong className="mt-2 block truncate whitespace-nowrap text-[15px] font-black leading-none">
        {value}
      </strong>
    </div>
  );
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
    .sort(
      (a, b) =>
        (a.bestActivity?.moving_time ?? Infinity) -
        (b.bestActivity?.moving_time ?? Infinity),
    )[0];

  return (
    <main className="ba-page">
      <Navbar />

      <section className="ba-container py-8">
        <section className="ba-card overflow-hidden">
          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.25),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6 md:p-8">
            <p className="ba-eyebrow">Correndo o Brasil</p>

            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Uma capital por vez.
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65 md:text-lg">
              Um projeto para correr uma meia maratona em cada uma das 27 capitais
              brasileiras. Os dados são puxados automaticamente do Strava e, quando há
              mais de uma meia na mesma capital, a página exibe a mais rápida.
            </p>

            <div className="mt-7 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-white/45">Capitais concluídas</p>
                <strong className="mt-2 block text-3xl font-black text-white">
                  {completed.length}/27
                </strong>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-white/45">Progresso</p>
                <strong className="mt-2 block text-3xl font-black text-white">
                  {progress}%
                </strong>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-white/45">Próximas missões</p>
                <strong className="mt-2 block text-3xl font-black text-white">
                  {next.length}
                </strong>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-white/45">Melhor meia</p>
                <strong className="mt-2 block text-3xl font-black text-white">
                  {fastest?.bestActivity
                    ? formatTime(fastest.bestActivity.moving_time)
                    : "—"}
                </strong>
                <p className="mt-1 text-xs text-white/40">
                  {fastest?.city ?? "Ainda sem dados"}
                </p>
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

        <section className="mt-10">
          <div className="mb-6">
            <p className="ba-eyebrow">Capitais concluídas</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
              Episódios já registrados
            </h2>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {completed.map((capital, index) => {
              const activity = capital.bestActivity;

              return (
                <article
                  key={capital.city}
                  className="rounded-[1.75rem] border border-emerald-400/25 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(0,0,0,0.38))] p-5 shadow-[0_0_32px_rgba(16,185,129,0.06)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">
                        EP {String(index + 1).padStart(2, "0")}
                      </p>

                      <h3 className="mt-3 truncate text-2xl font-black leading-tight text-white">
                        {capital.city} <span className="text-white/40">{capital.state}</span>
                      </h3>

                      <p className="mt-2 truncate text-sm text-white/60" title={cleanActivityName(activity?.name)}>
                        {cleanActivityName(activity?.name)}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                      Concluída
                    </span>
                  </div>

                  <div className="mt-5 border-y border-white/10 py-5">
                    <div className="grid grid-cols-3 gap-2">
                      <MetricBox label="Tempo" value={formatTime(activity?.moving_time)} />
                      <MetricBox label="Pace" value={formatPace(activity?.distance, activity?.moving_time)} />
                      <MetricBox label="Data" value={formatDateBR(activity?.start_date_local)} />
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <MetricBox label="Distância" value={formatDistance(activity?.distance)} />
                      <MetricBox
                        label="Altimetria"
                        value={`${activity?.total_elevation_gain?.toFixed(0) ?? "—"} m`}
                        tone="amber"
                      />
                      <MetricBox
                        label="FC Média"
                        value={`${activity?.average_heartrate?.toFixed(0) ?? "—"} bpm`}
                        tone="red"
                      />
                    </div>
                  </div>

                  <p className="mt-4 truncate text-sm text-white/45">
                    {capital.otherHalfMarathons.length > 0
                      ? `${capital.otherHalfMarathons.length + 1} meias nessa capital · exibindo a mais rápida`
                      : "Melhor meia identificada pelo Strava"}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="ba-card">
            <p className="ba-eyebrow">Mapa mental do projeto</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
              As 27 capitais
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">
                          {capital.city} <span className="text-white/40">{capital.state}</span>
                        </h3>
                        <p className="mt-1 text-xs text-white/40">{capital.region}</p>
                      </div>

                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
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
                          <strong className="text-white/80">
                            {formatTime(activity.moving_time)}
                          </strong>
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
            <div className="ba-card border-orange-400/20 bg-orange-500/10">
              <p className="ba-eyebrow">Próximas missões</p>

              <div className="mt-5 space-y-3">
                {next.map((capital) => (
                  <div
                    key={capital.city}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <h3 className="text-xl font-black text-white">
                      {capital.city} <span className="text-white/40">{capital.state}</span>
                    </h3>
                    <p className="mt-1 text-sm text-white/50">{capital.region}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ba-card">
              <p className="ba-eyebrow">Regras do desafio</p>

              <div className="mt-5 space-y-3 text-sm text-white/65">
                <p className="rounded-2xl bg-black/20 p-4">
                  A capital só entra como concluída se houver uma corrida de meia
                  maratona no Strava próxima à cidade.
                </p>

                <p className="rounded-2xl bg-black/20 p-4">
                  Se houver mais de uma meia na mesma capital, a página exibe
                  automaticamente a mais rápida.
                </p>

                <p className="rounded-2xl bg-black/20 p-4">
                  Distância considerada: entre 20,5 km e 22,7 km.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10">
          <div className="ba-card">
            <p className="ba-eyebrow">Progresso por região</p>

            <div className="mt-6 grid gap-4 md:grid-cols-5">
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
                  <div key={region} className="rounded-2xl bg-black/20 p-4">
                    <p className="text-sm text-white/50">{region}</p>

                    <strong className="mt-2 block text-3xl font-black text-white">
                      {regionCompleted.length}/{regionCapitals.length}
                    </strong>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${regionProgress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

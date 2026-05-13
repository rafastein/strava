export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import SisrunUploadForm from "../components/SisrunUploadForm";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { getSisrunData, getCurrentWeek, getTodaySisrunRow } from "../lib/sisrun-utils";

type StravaActivity = {
  id: number;
  type: string;
  distance: number;
  start_date?: string;
  start_date_local?: string;
};

type WeekRow = NonNullable<Awaited<ReturnType<typeof getSisrunData>>>["rows"][number];

function parseBrDateLocal(date: string) {
  const [day, month, year] = date.split("/").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getWeekRows(
  sisrunData: Awaited<ReturnType<typeof getSisrunData>>,
  currentWeek: ReturnType<typeof getCurrentWeek>
) {
  if (!sisrunData?.rows?.length || !currentWeek) return [];

  const start = parseBrDateLocal(currentWeek.weekStart);
  const end = parseBrDateLocal(currentWeek.weekEnd);

  return sisrunData.rows.filter((row) => {
    const rowDate = parseBrDateLocal(row.date);
    return rowDate >= start && rowDate <= end;
  });
}

function getDayLabel(date: string) {
  const parsed = parseBrDateLocal(date);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(parsed)
    .replace(".", "");
}

function getActivityDateKey(activity: StravaActivity) {
  const raw = activity.start_date_local ?? activity.start_date;
  if (!raw) return null;

  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

async function getWeekStravaKmByDate(currentWeek: ReturnType<typeof getCurrentWeek>) {
  if (!currentWeek) return new Map<string, number>();

  try {
    const token = await getValidStravaAccessToken();
    if (!token) return new Map<string, number>();

    const start = parseBrDateLocal(currentWeek.weekStart);
    const end = parseBrDateLocal(currentWeek.weekEnd);
    end.setHours(23, 59, 59, 999);

    const after = Math.floor(start.getTime() / 1000);
    const before = Math.floor(end.getTime() / 1000);

    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("after", String(after));
    url.searchParams.set("before", String(before));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return new Map<string, number>();

    const activities = (await res.json()) as StravaActivity[];
    const map = new Map<string, number>();

    activities
      .filter((activity) => activity.type === "Run")
      .forEach((activity) => {
        const key = getActivityDateKey(activity);
        if (!key) return;

        const current = map.get(key) ?? 0;
        map.set(key, current + activity.distance / 1000);
      });

    return map;
  } catch {
    return new Map<string, number>();
  }
}

function getCompletedKm(row: WeekRow, stravaKmByDate: Map<string, number>) {
  const fromSheet = row.completedDistanceKm ?? 0;
  const fromStrava = stravaKmByDate.get(row.date) ?? 0;

  return Number(Math.max(fromSheet, fromStrava).toFixed(1));
}

function formatKm(value: number) {
  return `${value.toFixed(1)} km`;
}

export default async function SisrunPage() {
  const sisrunData = await getSisrunData();
  const currentWeek = getCurrentWeek(sisrunData);
  const todayRow = getTodaySisrunRow(sisrunData);
  const weekRows = getWeekRows(sisrunData, currentWeek);
  const stravaKmByDate = await getWeekStravaKmByDate(currentWeek);
  const plannedDays = weekRows.filter((row) => row.plannedDistanceKm > 0).length;
  const completedTodayKm = todayRow ? getCompletedKm(todayRow, stravaKmByDate) : 0;

  return (
    <div className="page"><Navbar />
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="ba-page">
        <header className="ba-page-header">
          <div>
            <p className="ba-eyebrow">SisRUN</p>
            <h1 className="ba-title">Planejamento semanal</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">
              Planejamento extraído da planilha atual, com resumo da semana,
              volume previsto e distribuição dos treinos dia a dia.
            </p>
          </div>

          <Link href="/" className="ba-back">
            ← Voltar ao dashboard
          </Link>
        </header>

        <section className="ba-section grid gap-4 lg:grid-cols-[1fr_.95fr]">
          <SisrunUploadForm />

          <div className="ba-card p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ba-eyebrow">Semana atual</p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Resumo da semana
                </h2>
              </div>

              {currentWeek && (
                <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-[11px] font-semibold text-white/55">
                  {plannedDays} dias com treino
                </span>
              )}
            </div>

            {currentWeek ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/[.07] bg-black/15 px-4 py-3">
                  <p className="ba-label">Período</p>
                  <p className="mt-1 text-base font-semibold text-orange-300">
                    {currentWeek.weekStart} até {currentWeek.weekEnd}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard
                    title="Km planejados"
                    value={formatKm(currentWeek.totalPlannedKm)}
                  />
                  <InfoCard
                    title="Longão planejado"
                    value={formatKm(currentWeek.longRunPlannedKm)}
                  />
                </div>

                <div className="rounded-2xl border border-white/[.07] bg-black/15 px-4 py-3">
                  <p className="ba-label">Treino de hoje</p>

                  {todayRow ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <MiniMetric title="Planejado" value={formatKm(todayRow.plannedDistanceKm)} />
                      <MiniMetric title="Feito" value={formatKm(completedTodayKm)} />
                      <MiniMetric
                        title="Janela"
                        value={`${todayRow.minPlannedTime ?? "-"} / ${todayRow.maxPlannedTime ?? "-"}`}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/45">
                      Nenhum treino previsto para hoje.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-5 text-sm text-white/45">
                Nenhuma planilha carregada ainda.
              </div>
            )}
          </div>
        </section>

        <section className="ba-card p-4 md:p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="ba-eyebrow">Agenda</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Dias da semana atual
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Planejamento diário extraído da planilha do SisRUN, com execução preenchida pelo maior valor entre planilha e Strava.
              </p>
            </div>

            {currentWeek && (
              <div className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[11px] font-semibold text-white/50">
                {currentWeek.weekStart} — {currentWeek.weekEnd}
              </div>
            )}
          </div>

          {!sisrunData?.rows?.length || !currentWeek ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-5 text-sm text-white/45">
              Sem dados para exibir.
            </div>
          ) : (
            <div className="mt-5 grid gap-2.5">
              {weekRows.map((row, index) => {
                const hasWorkout = row.plannedDistanceKm > 0;
                const completedKm = getCompletedKm(row, stravaKmByDate);

                return (
                  <div
                    key={`${row.date}-${index}`}
                    className="rounded-2xl border border-white/[.075] bg-white/[.026] px-3 py-3 transition hover:border-white/15 hover:bg-white/[.04] md:px-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1.28fr_2fr] lg:items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black uppercase tracking-[.1em] ${
                            hasWorkout
                              ? "border-orange-400/25 bg-orange-400/10 text-orange-300"
                              : "border-white/10 bg-white/[.035] text-white/35"
                          }`}
                        >
                          {getDayLabel(row.date)}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] leading-none text-white/35">{row.date}</p>
                          <p className="mt-1.5 truncate text-sm font-semibold text-white/90">
                            {hasWorkout
                              ? `${formatKm(row.plannedDistanceKm)} planejados`
                              : "Descanso / sem volume planejado"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric title="Planejado" value={formatKm(row.plannedDistanceKm)} />
                        <Metric title="Feito" value={formatKm(completedKm)} />
                        <Metric title="Tempo mín." value={row.minPlannedTime ?? "-"} />
                        <Metric title="Tempo máx." value={row.maxPlannedTime ?? "-"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
    <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[.07] bg-black/15 px-4 py-3">
      <p className="ba-label">{title}</p>
      <p className="mt-2 text-2xl font-black uppercase tracking-[-.03em] text-white md:text-3xl">
        {value}
      </p>
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">{title}</p>
      <p className="mt-1 text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/15 px-2.5 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">{title}</p>
      <p className="mt-1 text-[13px] font-semibold text-white/85">{value}</p>
    </div>
  );
}

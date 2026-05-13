import Link from "next/link";
import SisrunUploadForm from "../components/SisrunUploadForm";
import { getSisrunData, getCurrentWeek, getTodaySisrunRow } from "../lib/sisrun-utils";

function getWeekRows(sisrunData: Awaited<ReturnType<typeof getSisrunData>>, currentWeek: ReturnType<typeof getCurrentWeek>) {
  if (!sisrunData?.rows?.length || !currentWeek) return [];

  const start = new Date(currentWeek.weekStart.split("/").reverse().join("-"));
  const end = new Date(currentWeek.weekEnd.split("/").reverse().join("-"));

  return sisrunData.rows.filter((row) => {
    const rowDate = new Date(row.date.split("/").reverse().join("-"));
    return rowDate >= start && rowDate <= end;
  });
}

function getDayLabel(date: string) {
  const parsed = new Date(`${date.split("/").reverse().join("-")}T12:00:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(parsed)
    .replace(".", "");
}

function formatKm(value: number) {
  return `${value.toFixed(1)} km`;
}

export default async function SisrunPage() {
  const sisrunData = await getSisrunData();
  const currentWeek = getCurrentWeek(sisrunData);
  const todayRow = getTodaySisrunRow(sisrunData);
  const weekRows = getWeekRows(sisrunData, currentWeek);
  const plannedDays = weekRows.filter((row) => row.plannedDistanceKm > 0).length;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="ba-page">
        <header className="ba-page-header">
          <div>
            <p className="ba-eyebrow">SisRUN</p>
            <h1 className="ba-title">Planejamento semanal</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/45">
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

          <div className="ba-card p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ba-eyebrow">Semana atual</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Resumo da semana
                </h2>
              </div>

              {currentWeek && (
                <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs font-semibold text-white/55">
                  {plannedDays} dias com treino
                </span>
              )}
            </div>

            {currentWeek ? (
              <div className="mt-5 space-y-4">
                <div className="ba-card-soft p-4">
                  <p className="ba-label">Período</p>
                  <p className="mt-2 text-lg font-semibold text-white">
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

                <div className="ba-card-soft p-4">
                  <p className="ba-label">Treino de hoje</p>

                  {todayRow ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-white/35">Distância planejada</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {formatKm(todayRow.plannedDistanceKm)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/35">Janela de tempo</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {todayRow.minPlannedTime ?? "-"} / {todayRow.maxPlannedTime ?? "-"}
                        </p>
                      </div>
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

        <section className="ba-card p-5 md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="ba-eyebrow">Agenda</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Dias da semana atual
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Planejamento diário extraído da planilha do SisRUN.
              </p>
            </div>

            {currentWeek && (
              <div className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-semibold text-white/50">
                {currentWeek.weekStart} — {currentWeek.weekEnd}
              </div>
            )}
          </div>

          {!sisrunData?.rows?.length || !currentWeek ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-5 text-sm text-white/45">
              Sem dados para exibir.
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {weekRows.map((row, index) => {
                const hasWorkout = row.plannedDistanceKm > 0;

                return (
                  <div
                    key={`${row.date}-${index}`}
                    className="rounded-2xl border border-white/[.075] bg-white/[.028] p-4 transition hover:border-white/15 hover:bg-white/[.04]"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1.35fr_2fr] lg:items-center">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xs font-black uppercase tracking-[.12em] ${
                            hasWorkout
                              ? "border-orange-400/25 bg-orange-400/10 text-orange-300"
                              : "border-white/10 bg-white/[.035] text-white/35"
                          }`}
                        >
                          {getDayLabel(row.date)}
                        </div>

                        <div>
                          <p className="text-xs text-white/35">{row.date}</p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {hasWorkout
                              ? `${formatKm(row.plannedDistanceKm)} planejados`
                              : "Descanso / sem volume planejado"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric title="Planejado" value={formatKm(row.plannedDistanceKm)} />
                        <Metric title="Feito" value={formatKm(row.completedDistanceKm)} />
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
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="ba-card-soft p-4">
      <p className="ba-label">{title}</p>
      <p className="ba-value mt-3 text-4xl">{value}</p>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-black/15 px-3 py-3">
      <p className="ba-label">{title}</p>
      <p className="mt-2 text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}

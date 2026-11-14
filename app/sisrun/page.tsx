// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Navbar from "../components/Navbar";
import SisrunUploadForm from "../components/SisrunUploadForm";
import { getStravaActivities, isRunActivity, type StravaActivitySummary } from "../lib/strava-client";
import {
  buildSisrunStatusSummary,
  getSisrunData,
  getSisrunDataWithSource,
  getCurrentWeek,
  getTodaySisrunRow,
  getSisrunDataQualityWarnings,
  isSisrunWeekCurrent,
} from "../lib/sisrun-utils";
import { formatDayMonth, formatKm, formatNumber, formatWeekdayShort } from "../lib/format";
import { getCurrentSeasonYear } from "../lib/season";

type StravaActivity = StravaActivitySummary;

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
  const end   = parseBrDateLocal(currentWeek.weekEnd);
  return sisrunData.rows.filter((row) => {
    const rowDate = parseBrDateLocal(row.date);
    return rowDate >= start && rowDate <= end;
  });
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
    const start = parseBrDateLocal(currentWeek.weekStart);
    const end   = parseBrDateLocal(currentWeek.weekEnd);
    end.setHours(23, 59, 59, 999);
    const activities = await getStravaActivities({
      after: Math.floor(start.getTime() / 1000),
      before: Math.floor(end.getTime() / 1000),
      perPage: 100,
      maxPages: 1,
    });
    const map = new Map<string, number>();
    activities.filter(isRunActivity).forEach((a) => {
      const key = getActivityDateKey(a);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + a.distance / 1000);
    });
    return map;
  } catch { return new Map<string, number>(); }
}

function getCompletedKm(row: WeekRow, stravaKmByDate: Map<string, number>) {
  return Number(Math.max(row.completedDistanceKm ?? 0, stravaKmByDate.get(row.date) ?? 0).toFixed(1));
}

/** "13/11/2026" → "2026-11-13" */
function toDateKey(brDate: string) {
  const [day, month, year] = brDate.split("/");
  return `${year}-${month}-${day}`;
}

function formatStatusValue(value: string | number | null) {
  if (value === null || value === "") return "—";
  return String(value);
}

export default async function SisrunPage() {
  const sisrunResult    = await getSisrunDataWithSource();
  const sisrunData      = sisrunResult.data;
  const currentWeek     = getCurrentWeek(sisrunData);
  const todayRow        = getTodaySisrunRow(sisrunData);
  const dataWarnings    = getSisrunDataQualityWarnings(sisrunData);
  const sisrunStatus    = buildSisrunStatusSummary(sisrunResult, dataWarnings);
  const weekRows        = getWeekRows(sisrunData, currentWeek);
  const stravaKmByDate  = await getWeekStravaKmByDate(currentWeek);
  const plannedDays     = weekRows.filter((r) => r.plannedDistanceKm > 0).length;
  const completedTodayKm = todayRow ? getCompletedKm(todayRow, stravaKmByDate) : 0;

  const weekPlannedKm = currentWeek?.totalPlannedKm ?? 0;
  const weekDoneKm = weekRows.reduce((sum, row) => sum + getCompletedKm(row, stravaKmByDate), 0);
  const weekPct = weekPlannedKm > 0 ? Math.min((weekDoneKm / weekPlannedKm) * 100, 100) : 0;
  const todayKey = todayRow ? toDateKey(todayRow.date) : null;
  // Com a planilha desatualizada, `currentWeek` é a última semana que ela tem, não a de hoje.
  const weekIsCurrent = isSisrunWeekCurrent(currentWeek);

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">SisRUN</h1>
            <p className="ui-muted">Planilha da assessoria: o planejado da semana contra o que foi feito</p>
          </div>
        </header>

        <div className="hoje-col">
          {/* ── Semana ── */}
          {currentWeek ? (
            <section className="ui-card ui-card--pad ui-stack" aria-label="Semana atual">
              <div className="ui-section__head" style={{ padding: 0 }}>
                <h2 className="ui-h2">{weekIsCurrent ? "Esta semana" : "Última semana da planilha"}</h2>
                <span className="ui-muted">
                  {formatDayMonth(toDateKey(currentWeek.weekStart))} – {formatDayMonth(toDateKey(currentWeek.weekEnd))}
                </span>
              </div>
              {weekIsCurrent ? null : (
                <p style={{ fontSize: 14, color: "var(--ui-accent)" }}>
                  A planilha não cobre a semana de hoje. Envie a versão mais recente em “Atualizar planilha”.
                </p>
              )}
              <p className="hoje-week__total">
                <span className="hoje-week__km">{formatKm(weekDoneKm)}</span>
                <span className="ui-muted" style={{ fontSize: 14 }}>de {formatKm(weekPlannedKm)} planejados</span>
              </p>
              <div className="hoje-progress" role="img" aria-label={`${formatNumber(weekPct)}% do volume planejado`}>
                <div className="hoje-progress__fill" style={{ width: `${weekPct}%` }} />
              </div>
              <dl className="ui-dl">
                <div><dt>Dias com treino</dt><dd>{plannedDays}</dd></div>
                <div><dt>Longão planejado</dt><dd>{currentWeek.longRunPlannedKm > 0 ? formatKm(currentWeek.longRunPlannedKm) : "—"}</dd></div>
                <div>
                  <dt>{weekIsCurrent ? "Hoje" : "Hoje (fora da planilha)"}</dt>
                  <dd>
                    {todayRow && todayRow.plannedDistanceKm > 0
                      ? `${formatKm(completedTodayKm)} de ${formatKm(todayRow.plannedDistanceKm)}`
                      : "sem treino"}
                  </dd>
                </div>
              </dl>
            </section>
          ) : (
            <section className="ui-card ui-card--pad ui-stack" aria-label="Semana atual">
              <h2 className="ui-h2">Nenhuma semana encontrada</h2>
              <p className="ui-muted" style={{ fontSize: 14 }}>
                {sisrunData?.rows?.length
                  ? "A planilha carregada não cobre a semana atual. Envie a versão mais recente logo abaixo."
                  : "Nenhuma planilha carregada ainda. Envie a exportação do SisRUN logo abaixo."}
              </p>
            </section>
          )}

          {/* ── Alertas de qualidade ── */}
          {dataWarnings.length > 0 ? (
            <section className="ui-card ui-card--pad ui-stack" aria-label="Atenção à planilha" style={{ borderColor: "var(--ui-accent)" }}>
              <h2 className="ui-h2">Atenção à planilha</h2>
              {dataWarnings.map((warning, index) => (
                <p key={`${warning.title}-${index}`} style={{ fontSize: 14 }}>
                  <strong style={{ color: warning.level === "error" ? "#ff8a7a" : "var(--ui-accent)" }}>{warning.title}.</strong>{" "}
                  <span style={{ color: "var(--ui-text-2)" }}>{warning.description}</span>
                </p>
              ))}
            </section>
          ) : null}

          {/* ── Dias ── */}
          {currentWeek && weekRows.length > 0 ? (
            <section className="ui-section" aria-label="Dias da semana">
              <div className="ui-section__head">
                <h2 className="ui-h2">Dia a dia</h2>
                <span className="ui-muted">feito = maior entre planilha e Strava</span>
              </div>
              <div className="ui-card ui-list">
                {weekRows.map((row, index) => {
                  const hasWorkout = row.plannedDistanceKm > 0;
                  const completedKm = getCompletedKm(row, stravaKmByDate);
                  const done = hasWorkout && completedKm >= row.plannedDistanceKm;
                  const dateKey = toDateKey(row.date);
                  const [day] = formatDayMonth(dateKey).split(" ");
                  const hasTime = (value?: string | null) => Boolean(value && !/^0?0:00(:00)?$/.test(value));
                  const window = hasWorkout && (hasTime(row.minPlannedTime) || hasTime(row.maxPlannedTime))
                    ? `${row.minPlannedTime ?? "—"} a ${row.maxPlannedTime ?? "—"}`
                    : null;

                  return (
                    <div key={`${row.date}-${index}`} className="ui-row ui-row--date">
                      <span className="ui-date">
                        <span className="ui-date__day">{day}</span>
                        <span className="ui-muted" style={{ fontSize: 12 }}>{formatWeekdayShort(dateKey)}</span>
                      </span>
                      <span className="ui-row__main">
                        <span className="ui-row__title" style={hasWorkout ? undefined : { color: "var(--ui-muted)", fontWeight: 400 }}>
                          {hasWorkout ? `${formatKm(row.plannedDistanceKm)} planejados` : "Descanso"}
                          {dateKey === todayKey ? <span className="ui-tag-accent"> · hoje</span> : null}
                        </span>
                        {window ? <span className="ui-muted" style={{ fontSize: 12 }}>tempo previsto: {window}</span> : null}
                      </span>
                      <span className="ui-row__side">
                        <span className="ui-row__value" style={completedKm > 0 ? undefined : { color: "var(--ui-muted)", fontWeight: 400 }}>
                          {completedKm > 0 ? formatKm(completedKm) : "—"}
                        </span>
                        {done ? <span style={{ fontSize: 12, color: "var(--ui-good)" }}>cumprido</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ── Manutenção ── */}
          <details className="ui-card ui-details" style={{ marginTop: 12 }} open={!sisrunData?.rows?.length || !weekIsCurrent}>
            <summary>Atualizar planilha<Chevron /></summary>
            <div className="ui-details__body">
              <SisrunUploadForm />
            </div>
          </details>

          <details className="ui-card ui-details">
            <summary>Fonte dos dados<Chevron /></summary>
            <div className="ui-details__body">
              <dl className="ui-dl">
                {[
                  { label: "Fonte atual", value: sisrunStatus.sourceLabel },
                  { label: "Arquivo", value: sisrunStatus.fileName },
                  { label: "Enviado em", value: sisrunStatus.uploadedAtLabel },
                  { label: "Semanas", value: sisrunStatus.weeksCount },
                  { label: "Treinos", value: sisrunStatus.workoutCount },
                  { label: "Km planejados", value: formatKm(sisrunStatus.totalPlannedKm) },
                  { label: "Primeira semana", value: sisrunStatus.firstWeekLabel },
                  { label: "Última semana", value: sisrunStatus.lastWeekLabel },
                ].map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd style={{ fontSize: 14, overflowWrap: "anywhere" }}>{formatStatusValue(item.value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="ui-muted" style={{ overflowWrap: "anywhere" }}>
                {sisrunStatus.rowsCount} linhas lidas · chave Redis: {formatStatusValue(sisrunStatus.key)}
                {sisrunStatus.error ? ` · observação técnica: ${sisrunStatus.error}` : ""}
              </p>
            </div>
          </details>
        </div>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

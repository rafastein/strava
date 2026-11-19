import WeekDayBars from "../components/WeekDayBars";
import HubPage from "../components/ui/HubPage";
import { formatDateRangeShort, formatKm, formatNumber } from "../lib/format";
import {
  buildPlanHistory,
  getCorosPlannedKmByDate,
  getHistoryStartKey,
  getPlannedKmUntil,
  summarizePlanHistory,
  type PlanWeek,
} from "../lib/plan-history";
import { getAllStructuredPlannedWorkouts } from "../lib/planned-workout";
import { getRaceCalendarTodayKey } from "../lib/race-calendar";
import { getStravaActivities } from "../lib/strava-client";

export const revalidate = 0;
export const metadata = { title: "Treinos · Rafael Cabral" };

const HISTORY_WEEKS = 12;

function Chevron() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function adherenceTone(pct: number) {
  if (pct >= 90) return "plan-week__pct--good";
  if (pct >= 70) return "";
  return "plan-week__pct--low";
}

function WeekRow({ week, todayKey, scaleKm }: { week: PlanWeek; todayKey: string; scaleKm: number }) {
  const label = formatDateRangeShort(week.days[0].dateKey, week.days[6].dateKey);
  const plannedSoFar = week.isCurrent ? getPlannedKmUntil(week, todayKey) : week.plannedKm;
  const pct = plannedSoFar > 0 ? Math.round((week.km / plannedSoFar) * 100) : null;
  const weekMax = Math.max(...week.days.map((day) => Math.max(day.km, day.plannedKm)), 1);

  return (
    <details className="ui-details plan-week">
      <summary>
        <span className="plan-week__main">
          <span className="plan-week__head">
            <span className="plan-week__label">{week.isCurrent ? "Esta semana" : label}</span>
            <span className="plan-week__nums">
              {week.plannedKm > 0 ? (
                <>
                  {formatNumber(week.km, 1)} <span className="ui-muted">/ {formatKm(week.plannedKm)}</span>
                </>
              ) : (
                <>
                  {formatKm(week.km)} <span className="ui-muted">· sem plano</span>
                </>
              )}
            </span>
          </span>
          <span className="plan-week__track" aria-hidden="true">
            {week.plannedKm > 0 ? (
              <span className="plan-week__plan" style={{ width: `${(week.plannedKm / scaleKm) * 100}%` }} />
            ) : null}
            {week.km > 0 ? <span className="plan-week__done" style={{ width: `${(week.km / scaleKm) * 100}%` }} /> : null}
          </span>
        </span>
        {pct !== null ? (
          <span className={`plan-week__pct ${adherenceTone(pct)}`}>
            {pct}%<span className="sr-only"> do plano{week.isCurrent ? " previsto até agora" : ""}</span>
          </span>
        ) : (
          <span className="plan-week__pct plan-week__pct--none">—</span>
        )}
        <Chevron />
      </summary>
      <div className="ui-details__body">
        <WeekDayBars days={week.days} todayKey={todayKey} maxKm={weekMax} compact />
        <p className="ui-muted" style={{ fontSize: 13 }}>
          {week.runs === 0 ? "Nenhuma corrida" : week.runs === 1 ? "1 corrida" : `${week.runs} corridas`}
          {week.isCurrent && week.plannedKm > 0
            ? ` · ${formatKm(plannedSoFar)} previstos até agora, ${formatKm(week.plannedKm)} na semana`
            : ""}
        </p>
      </div>
    </details>
  );
}

export default async function TreinosPage() {
  const todayKey = getRaceCalendarTodayKey();
  const startKey = getHistoryStartKey(todayKey, HISTORY_WEEKS - 1) ?? todayKey;
  // Meia-noite em São Paulo (UTC-3); um dia a mais de margem não muda nada, a semana filtra pela data local.
  const after = Math.floor(Date.parse(`${startKey}T03:00:00Z`) / 1000) - 86_400;

  const [activities, structured] = await Promise.all([
    getStravaActivities({ after, maxPages: 5 }),
    getAllStructuredPlannedWorkouts(),
  ]);

  const history = buildPlanHistory({
    activities,
    corosByDate: getCorosPlannedKmByDate(structured),
    todayKey,
    weeks: HISTORY_WEEKS,
  });
  const summary = summarizePlanHistory(history);
  const visibleWeeks = history.filter((week) => week.isCurrent || week.plannedKm > 0 || week.km > 0);
  const scaleKm = Math.max(...visibleWeeks.map((week) => Math.max(week.km, week.plannedKm)), 1);
  const hasAnyPlan = history.some((week) => week.plannedKm > 0);

  return (
    <HubPage
      title="Treinos"
      description="Análise dos treinos e o plano da semana."
      links={[
        { href: "/longoes", label: "Longões", description: "Pace, eficiência e evolução dos treinos longos." },
        { href: "/treinos-qualidade", label: "Treinos de qualidade", description: "Intervalados, fartleks e progressivos." },
        { href: "/coros", label: "Plano COROS", description: "Treinos estruturados e calendário planejado." },
      ]}
    >
      <section className="ui-section" aria-labelledby="plan-history-title" style={{ marginBottom: 12 }}>
        <div className="ui-card">
          <div className="ui-card--pad ui-stack" style={{ gap: 6, paddingBottom: 12 }}>
            <div className="ui-section__head" style={{ padding: 0 }}>
              <h2 id="plan-history-title" className="ui-h2">Planejado × feito</h2>
              <span className="ui-muted">últimas {HISTORY_WEEKS} semanas</span>
            </div>
            {summary.adherencePct !== null ? (
              <p className="hoje-week__total">
                <span className="hoje-week__km">{summary.adherencePct}%</span>
                <span className="ui-muted" style={{ fontSize: 14 }}>
                  do plano em {summary.weeks === 1 ? "1 semana encerrada" : `${summary.weeks} semanas encerradas`} ·{" "}
                  {formatNumber(summary.km, 1)} de {formatKm(summary.plannedKm)}
                </span>
              </p>
            ) : (
              <p className="ui-muted" style={{ fontSize: 14 }}>
                {hasAnyPlan
                  ? "Ainda não há semana encerrada com plano; a semana atual aparece abaixo."
                  : "Nenhum plano do COROS nessas semanas. Abaixo, só o volume feito."}
              </p>
            )}
            {hasAnyPlan ? (
              <div className="carga-legend" style={{ fontSize: 12 }} aria-hidden="true">
                <span className="carga-legend__item"><span className="hoje-legend-swatch" />feito</span>
                <span className="carga-legend__item"><span className="hoje-legend-swatch hoje-legend-swatch--plan" />planejado</span>
              </div>
            ) : null}
          </div>
          <div className="plan-weeks">
            {visibleWeeks.map((week) => (
              <WeekRow key={week.weekStartKey} week={week} todayKey={todayKey} scaleKm={scaleKm} />
            ))}
          </div>
        </div>
      </section>
    </HubPage>
  );
}

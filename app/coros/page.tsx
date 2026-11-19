// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import Navbar from "../components/Navbar";
import CorosConnectionCard from "./CorosConnectionCard";
import CorosImportScheduleForm from "./CorosImportScheduleForm";
import { getCorosConnectionInfo } from "../lib/coros-oauth";
import { readCorosSyncStatus } from "../lib/coros-sync";
import CorosSavedWorkoutsList from "./CorosSavedWorkoutsList";
import {
  formatPlannedWorkoutDateWithWeekdayLabel,
  getAllStructuredPlannedWorkouts,
  getStructuredPlannedWorkout,
  getStructuredWorkoutSourceLabel,
  getTodayIsoDate,
  type StructuredPlannedWorkout,
} from "../lib/planned-workout";
import { getStravaActivities, getStravaAthlete, STRAVA_2024_START_EPOCH, isRunActivity, type StravaActivitySummary, type StravaGear } from "../lib/strava-client";
import { buildGearRecommendationSummaries } from "../lib/equipment-strava-summary";
import {
  buildSequentialShoeRecommendations,
  getEquipmentWorkoutFromRace,
  getEquipmentWorkoutFromStructuredWorkout,
} from "../lib/equipment-recommendation";
import { getRaceCalendarData, type ManagedRace } from "../lib/race-calendar";
import { formatKm } from "../lib/format";
import { getCurrentSeasonYear } from "../lib/season";

type WorkoutCompletionStatus = "done" | "off_target" | "today" | "missed" | "future";

function buildActualRunKmByDate(activities: StravaActivitySummary[]) {
  const byDate = new Map<string, number>();

  activities.filter(isRunActivity).forEach((activity) => {
    const dateKey = (activity.start_date_local ?? activity.start_date ?? "").slice(0, 10);
    if (!dateKey) return;

    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + activity.distance / 1000);
  });

  return byDate;
}

function getWorkoutCompletionStatus({
  date,
  plannedDistanceKm,
  actualKm,
  todayIso,
}: {
  date: string;
  plannedDistanceKm?: number | null;
  actualKm: number;
  todayIso: string;
}): WorkoutCompletionStatus {
  if (actualKm > 0) {
    const hasPlannedDistance = typeof plannedDistanceKm === "number" && Number.isFinite(plannedDistanceKm) && plannedDistanceKm > 0;
    const ratio = hasPlannedDistance ? actualKm / plannedDistanceKm : null;

    if (ratio !== null && (ratio < 0.8 || ratio > 1.2)) return "off_target";
    return "done";
  }

  if (date === todayIso) return "today";
  if (date < todayIso) return "missed";
  return "future";
}

function pickRaceForRecommendation(races: ManagedRace[]) {
  return [...races].sort((a, b) => {
    const goalDiff = Number(Boolean(b.isGoal)) - Number(Boolean(a.isGoal));
    if (goalDiff !== 0) return goalDiff;
    return b.distanceKm - a.distanceKm || a.name.localeCompare(b.name, "pt-BR");
  })[0] ?? null;
}

const SAMPLE_JSON = `{
  "date": "2026-06-11",
  "source": "coros",
  "title": "2 km Z1 + 7x 500m Z2 / 500m Z1",
  "distanceKm": 9,
  "estimatedTime": "1:00:00",
  "loadTl": 97,
  "durationMin": 60,
  "steps": [
    { "label": "Aquecimento", "distanceKm": 2, "intensity": "Z1", "kind": "aquecimento" },
    { "label": "500m Z2", "repeat": 7, "distanceKm": 0.5, "intensity": "Z2", "kind": "bloco" },
    { "label": "500m Z1", "repeat": 7, "distanceKm": 0.5, "intensity": "Z1", "kind": "recuperacao" }
  ]
}`;

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CorosPage({ searchParams }: PageProps) {
  const todayIso = getTodayIsoDate();
  const params = await searchParams;
  const [corosConnection, corosSync] = await Promise.all([getCorosConnectionInfo(), readCorosSyncStatus()]);
  const [todayWorkoutResult, nextWorkouts, activities, athlete, raceCalendar] = await Promise.all([
    getStructuredPlannedWorkout(todayIso),
    getAllStructuredPlannedWorkouts(),
    getStravaActivities({ after: STRAVA_2024_START_EPOCH, maxPages: 20 }),
    getStravaAthlete(),
    getRaceCalendarData(),
  ]);

  const savedWorkouts = nextWorkouts.filter(
    (result): result is typeof result & { data: StructuredPlannedWorkout } => Boolean(result.data),
  );
  const gears = buildGearRecommendationSummaries(activities, Array.isArray(athlete?.shoes) ? athlete.shoes as StravaGear[] : []);
  const actualRunKmByDate = buildActualRunKmByDate(activities);
  const todayActualKm = actualRunKmByDate.get(todayIso) ?? 0;
  const todayStatus = getWorkoutCompletionStatus({
    date: todayIso,
    plannedDistanceKm: todayWorkoutResult.data?.distanceKm ?? null,
    actualKm: todayActualKm,
    todayIso,
  });

  const structuredWorkoutByDate = new Map(
    savedWorkouts.map((result) => [result.data.date, result.data] as const),
  );
  const racesByDate = new Map<string, ManagedRace[]>();
  raceCalendar.races.forEach((race) => {
    racesByDate.set(race.dateKey, [...(racesByDate.get(race.dateKey) ?? []), race]);
  });

  const recommendationDates = Array.from(new Set([
    ...savedWorkouts.map((result) => result.data.date),
    ...raceCalendar.races.map((race) => race.dateKey),
  ])).sort();

  const sequentialRecommendations = buildSequentialShoeRecommendations(
    gears,
    recommendationDates.map((date) => {
      const race = pickRaceForRecommendation(racesByDate.get(date) ?? []);
      const structuredWorkout = structuredWorkoutByDate.get(date);

      return {
        date,
        workout: race
          ? getEquipmentWorkoutFromRace(race)
          : getEquipmentWorkoutFromStructuredWorkout(structuredWorkout!),
      };
    }),
    { startDateIso: todayIso },
  );

  const recommendationByDate = new Map(
    recommendationDates.map((date) => [
      date,
      sequentialRecommendations.get(date)?.name ?? null,
    ] as const),
  );

  const todayWorkout = todayWorkoutResult.data;
  const todayMeta = TODAY_STATUS[todayStatus];

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Plano COROS</h1>
            <p className="ui-muted">Treinos estruturados e provas, com o tênis recomendado para cada dia</p>
          </div>
        </header>

        <div className="hoje-col">
          {/* ── Hoje ── */}
          <section className="ui-card ui-card--pad ui-stack" aria-label="Treino de hoje">
            <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
              <p className="ui-label-accent">Hoje</p>
              {todayWorkout ? <span style={{ fontSize: 12, fontWeight: 600, color: todayMeta.color }}>{todayMeta.label}</span> : null}
            </div>
            {todayWorkout ? (
              <WorkoutPreview workout={todayWorkout} actualKm={todayActualKm} />
            ) : (
              <>
                <h2 className="hoje-race__title" style={{ fontSize: 22 }}>Nenhum treino estruturado para hoje</h2>
                <p className="ui-muted" style={{ fontSize: 14 }}>
                  Sem treino do COROS para hoje, não há recomendação de tênis pelo tipo de treino.
                </p>
              </>
            )}
          </section>

          {/* ── Agenda ── */}
          <section className="ui-section" aria-label="Agenda">
            <div className="ui-section__head">
              <h2 className="ui-h2">Agenda</h2>
            </div>
            <CorosSavedWorkoutsList
              todayDate={todayIso}
              races={raceCalendar.races.map((race) => ({
                id: race.id,
                date: race.dateKey,
                name: race.name,
                location: race.location,
                distanceKm: race.distanceKm,
                objective: race.objective,
                targetPaceSecPerKm: race.targetPaceSecPerKm,
                isGoal: race.isGoal,
                href: race.href,
                actualKm: actualRunKmByDate.get(race.dateKey) ?? 0,
                shoeName: recommendationByDate.get(race.dateKey) ?? null,
                status: getWorkoutCompletionStatus({
                  date: race.dateKey,
                  plannedDistanceKm: race.distanceKm,
                  actualKm: actualRunKmByDate.get(race.dateKey) ?? 0,
                  todayIso,
                }),
              }))}
              workouts={savedWorkouts.map((result) => ({
                redisKey: result.key,
                date: result.data.date,
                dateLabel: formatPlannedWorkoutDateWithWeekdayLabel(result.data.date),
                title: result.data.title,
                sourceLabel: getStructuredWorkoutSourceLabel(result.data.source),
                type: result.data.type,
                shoeName: recommendationByDate.get(result.data.date) ?? null,
                distanceKm: result.data.distanceKm ?? null,
                estimatedTime: result.data.estimatedTime ?? null,
                loadTl: result.data.loadTl ?? null,
                actualKm: actualRunKmByDate.get(result.data.date) ?? 0,
                status: getWorkoutCompletionStatus({
                  date: result.data.date,
                  plannedDistanceKm: result.data.distanceKm ?? null,
                  actualKm: actualRunKmByDate.get(result.data.date) ?? 0,
                  todayIso,
                }),
              }))}
            />
            <Link href="/equipamentos" className="ui-btn ui-btn--ghost">Ver recomendação de tênis</Link>
          </section>

          {/* ── Conexão ── */}
          <div style={{ marginTop: 12 }}>
            <CorosConnectionCard
              connected={corosConnection.connected}
              connectedAt={corosConnection.connectedAt}
              lastSync={corosSync}
              redisConfigured={todayWorkoutResult.redisConfigured}
              returnStatus={firstParam(params.coros)}
              returnDetail={firstParam(params.detalhe)}
            />
          </div>

          {/* ── Manutenção, recolhida ── */}
          <details className="ui-card ui-details">
            <summary>Importar agenda manualmente<Chevron /></summary>
            <div className="ui-details__body">
              <p>
                Plano B, se a conexão falhar: consulte a agenda pelo MCP, cole o texto aqui e importe. Teste primeiro;
                depois desmarque para gravar. A senha administrativa é pedida na hora de enviar.
              </p>
              <CorosImportScheduleForm />
            </div>
          </details>

          <details className="ui-card ui-details">
            <summary>Fontes e diagnóstico<Chevron /></summary>
            <div className="ui-details__body">
              <dl className="ui-dl">
                <div>
                  <dt>Treino de hoje vem de</dt>
                  <dd style={{ fontSize: 15 }}>{todayWorkout ? getStructuredWorkoutSourceLabel(todayWorkout.source) : "Nenhum treino cadastrado"}</dd>
                </div>
                <div>
                  <dt>Upstash</dt>
                  <dd style={{ fontSize: 15 }}>{todayWorkoutResult.redisConfigured ? "Configurado" : "Não configurado"}</dd>
                </div>
              </dl>
              <p className="ui-muted">
                Chave de hoje: {todayWorkoutResult.key}. {todayWorkoutResult.sourceLabel}.
              </p>
              <p>
                <strong>Fonte dos dados:</strong> treino estruturado do COROS no Upstash; sem ele, o dia fica sem treino.
              </p>
            </div>
          </details>

          <details className="ui-card ui-details">
            <summary>Rotas para automação<Chevron /></summary>
            <div className="ui-details__body">
              <p>As rotas protegidas continuam disponíveis para scripts. O segredo vai no cabeçalho, não na URL.</p>
              <pre style={{ overflowX: "auto", borderRadius: 14, background: "var(--ui-bg)", border: "1px solid var(--ui-border)", color: "var(--ui-text-2)", padding: 14, fontSize: 12, lineHeight: 1.6 }}>
{`POST /api/planned-workout
Header: x-admin-secret: seu ADMIN_SECRET
Content-Type: application/json

${SAMPLE_JSON}

---

POST /api/coros/import-schedule
Header: x-admin-secret: seu ADMIN_SECRET
Content-Type: application/json

{
  "preferredTitlesByDate": { "2026-06-13": "Longão 23k" },
  "text": "Training Schedule\n========================\n..."
}`}
              </pre>
            </div>
          </details>
        </div>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

const TODAY_STATUS: Record<WorkoutCompletionStatus, { label: string; color: string }> = {
  done: { label: "Feito", color: "var(--ui-good)" },
  off_target: { label: "Fora da margem", color: "var(--ui-accent)" },
  today: { label: "Pendente", color: "var(--ui-blue)" },
  missed: { label: "Não feito", color: "#ff8a7a" },
  future: { label: "Futuro", color: "var(--ui-muted)" },
};

function Chevron() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function WorkoutPreview({ workout, actualKm }: { workout: StructuredPlannedWorkout; actualKm: number }) {
  const summary = [
    workout.type,
    workout.distanceKm ? formatKm(workout.distanceKm) : null,
    workout.estimatedTime ? workout.estimatedTime : workout.durationMin ? `${workout.durationMin} min` : null,
    workout.loadTl ? `${Math.round(workout.loadTl)} TL` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div>
        <h2 className="hoje-race__title" style={{ fontSize: 22 }}>{workout.title}</h2>
        <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>{summary}</p>
        {actualKm > 0 ? <p className="ui-muted" style={{ fontSize: 14 }}>Feito hoje: {formatKm(actualKm)}</p> : null}
      </div>
      {workout.description ? <p style={{ fontSize: 14, color: "var(--ui-text-2)" }}>{workout.description}</p> : null}
      {workout.steps.length > 0 ? (
        <ol className="ui-list" style={{ listStyle: "none", margin: "0 -20px", borderTop: "1px solid var(--ui-border)" }}>
          {workout.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="ui-row" style={{ minHeight: 52 }}>
              <span className="ui-row__main">
                <span className="ui-row__title" style={{ whiteSpace: "normal" }}>
                  {step.repeat ? `${step.repeat}× ` : ""}{step.label}
                </span>
              </span>
              <span className="ui-muted" style={{ flexShrink: 0, textAlign: "right" }}>
                {[
                  step.distanceKm ? formatKm(step.distanceKm, step.distanceKm < 1 ? 2 : 1) : null,
                  step.durationMin ? `${step.durationMin} min` : null,
                  step.intensity,
                ].filter(Boolean).join(" · ") || "sem alvo"}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import CorosImportScheduleForm from "./CorosImportScheduleForm";
import CorosSavedWorkoutsList from "./CorosSavedWorkoutsList";
import {
  buildSisrunFallbackWorkoutSummary,
  formatPlannedWorkoutDateWithWeekdayLabel,
  getAllStructuredPlannedWorkouts,
  getStructuredPlannedWorkout,
  getStructuredWorkoutSourceLabel,
  getTodayIsoDate,
  type StructuredPlannedWorkout,
} from "../lib/planned-workout";
import { getSisrunDataWithSource } from "../lib/sisrun-utils";
import { getStravaActivities, getStravaAthlete, STRAVA_2024_START_EPOCH, isRunActivity, type StravaActivitySummary, type StravaGear } from "../lib/strava-client";
import { buildGearRecommendationSummaries } from "../lib/equipment-strava-summary";
import {
  buildSequentialShoeRecommendations,
  getEquipmentWorkoutFromRace,
  getEquipmentWorkoutFromStructuredWorkout,
} from "../lib/equipment-recommendation";
import { getRaceCalendarData, type ManagedRace } from "../lib/race-calendar";

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

function getWorkoutStatusCardStyle(status: WorkoutCompletionStatus) {
  if (status === "done") {
    return {
      background: "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(255,255,255,0.025))",
      border: "1px solid rgba(16,185,129,0.24)",
    };
  }

  if (status === "off_target") {
    return {
      background: "linear-gradient(180deg, rgba(245,158,11,0.15), rgba(255,255,255,0.025))",
      border: "1px solid rgba(245,158,11,0.30)",
    };
  }

  if (status === "missed") {
    return {
      background: "linear-gradient(180deg, rgba(239,68,68,0.12), rgba(255,255,255,0.025))",
      border: "1px solid rgba(239,68,68,0.24)",
    };
  }

  return {
    background: "linear-gradient(180deg, rgba(59,130,246,0.14), rgba(255,255,255,0.025))",
    border: "1px solid rgba(59,130,246,0.28)",
  };
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

export default async function CorosPage() {
  const todayIso = getTodayIsoDate();
  const [todayWorkoutResult, nextWorkouts, sisrunResult, activities, athlete, raceCalendar] = await Promise.all([
    getStructuredPlannedWorkout(todayIso),
    getAllStructuredPlannedWorkouts(),
    getSisrunDataWithSource(),
    getStravaActivities({ after: STRAVA_2024_START_EPOCH, maxPages: 20 }),
    getStravaAthlete(),
    getRaceCalendarData(),
  ]);

  const sisrunSummary = buildSisrunFallbackWorkoutSummary(sisrunResult.data);
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
  const todayStatusStyle = getWorkoutStatusCardStyle(todayStatus);

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

  return (
    <div className="page">
      <Navbar />
      <main className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">COROS / treino estruturado</p>
            <h1 className="ba-title">COROS</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Laboratório para evoluir a integração com treinos estruturados. Por enquanto, a página lê e salva treinos normalizados no Upstash; o SisRUN permanece como fallback.
            </p>
          </div>
          <Link href="/equipamentos" className="ba-back">Ver recomendação de tênis →</Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3" style={{ marginBottom: "2rem" }}>
          <StatusCard
            label="Fonte primária"
            value={todayWorkoutResult.data ? getStructuredWorkoutSourceLabel(todayWorkoutResult.data.source) : "Nenhum treino estruturado"}
            helper={todayWorkoutResult.data ? `Chave ${todayWorkoutResult.key}` : "A página Equipamentos usa SisRUN como fallback."}
          />
          <StatusCard
            label="Upstash"
            value={todayWorkoutResult.redisConfigured ? "Configurado" : "Não configurado"}
            helper={todayWorkoutResult.sourceLabel}
          />
          <StatusCard
            label="Fallback SisRUN"
            value={sisrunResult.sourceLabel}
            helper={`${sisrunSummary.weeks} semanas · ${sisrunSummary.workouts} treinos`}
          />
        </section>

        <section
          className="ba-section ba-card"
          style={{
            padding: "1.5rem",
            background: todayWorkoutResult.data ? todayStatusStyle.background : undefined,
            border: todayWorkoutResult.data ? todayStatusStyle.border : undefined,
          }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="ba-eyebrow">Treino estruturado de hoje</p>
              {todayWorkoutResult.data ? (
                <WorkoutPreview workout={todayWorkoutResult.data} />
              ) : (
                <>
                  <h2 className="ba-title" style={{ fontSize: "1.9rem", marginTop: 4 }}>
                    Nenhum treino estruturado para hoje
                  </h2>
                  <p className="ba-muted" style={{ marginTop: ".5rem" }}>
                    Hoje a página de equipamentos continuará usando o SisRUN como fallback. Quando o treino vier do COROS, ele deve ser salvo na chave <strong>{todayWorkoutResult.key}</strong>.
                  </p>
                </>
              )}
            </div>

            <div className="ba-card-soft" style={{ padding: "1rem", minWidth: 280 }}>
              <p className="ba-label">Prioridade de dados</p>
              <ol style={{ marginTop: ".7rem", paddingLeft: "1.2rem", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.75 }}>
                <li>COROS / treino estruturado no Upstash</li>
                <li>SisRUN detalhado, quando houver descrição</li>
                <li>SisRUN resumido</li>
                <li>Descanso ou treino indefinido</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Agenda integrada</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Treinos COROS + provas</h2>
          <p className="ba-muted" style={{ marginTop: ".5rem" }}>
            O calendário combina os treinos estruturados salvos do COROS com as provas cadastradas na página Provas. Quando os dois caem no mesmo dia, a prova tem prioridade na recomendação de tênis.
          </p>
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
        </section>

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Importação manual do MCP</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Colar agenda COROS e salvar no Upstash</h2>
          <p className="ba-muted" style={{ marginTop: ".5rem" }}>
            Quando você atualizar algo no COROS, consulte a agenda pelo MCP, cole o texto bruto aqui e importe. Use o modo teste primeiro; depois desmarque para gravar.
          </p>
          <CorosImportScheduleForm />
        </section>

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Entrada técnica</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Como salvar um treino estruturado</h2>
          <p className="ba-muted" style={{ marginTop: ".5rem" }}>
            A rota protegida abaixo continua disponível para automações externas ou scripts locais.
          </p>
          <pre className="mt-4 overflow-auto rounded-2xl" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", padding: "1rem", fontSize: 12, lineHeight: 1.6 }}>
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
        </section>
      </main>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

function StatusCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="ba-card" style={{ padding: "1.25rem" }}>
      <p className="ba-label">{label}</p>
      <p style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{value}</p>
      <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>{helper}</p>
    </div>
  );
}

function WorkoutPreview({ workout }: { workout: StructuredPlannedWorkout }) {
  return (
    <div>
      <h2 className="ba-title" style={{ fontSize: "1.9rem", marginTop: 4 }}>{workout.title}</h2>
      <p className="ba-muted" style={{ marginTop: ".5rem" }}>
        {getStructuredWorkoutSourceLabel(workout.source)} · {workout.type}
        {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(1)} km` : ""}
        {workout.loadTl ? ` · ${Math.round(workout.loadTl)} TL` : ""}
        {workout.estimatedTime ? ` · ${workout.estimatedTime}` : workout.durationMin ? ` · ${workout.durationMin} min` : ""}
      </p>
      {workout.description && <p className="ba-muted" style={{ marginTop: ".5rem" }}>{workout.description}</p>}
      {workout.steps.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {workout.steps.map((step, index) => (
            <div key={`${step.label}-${index}`} className="ba-card-soft" style={{ padding: ".8rem 1rem" }}>
              <p style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>
                {step.repeat ? `${step.repeat}x ` : ""}{step.label}
              </p>
              <p className="ba-muted" style={{ marginTop: 3, fontSize: 12 }}>
                {[step.distanceKm ? `${step.distanceKm.toFixed(2)} km` : null, step.durationMin ? `${step.durationMin} min` : null, step.intensity].filter(Boolean).join(" · ") || "Sem alvo detalhado"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

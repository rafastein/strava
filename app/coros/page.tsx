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
import { getStravaActivities, getStravaAthlete, STRAVA_2024_START_EPOCH, isRunActivity, type StravaGear } from "../lib/strava-client";
import { buildGearRecommendationSummaries } from "../lib/equipment-strava-summary";
import { getEquipmentWorkoutFromStructuredWorkout, pickRecommendedShoeForWorkout } from "../lib/equipment-recommendation";

const SAMPLE_JSON = `{
  "date": "2026-06-11",
  "source": "coros",
  "title": "2 km Z1 + 7x 500m Z2 / 500m Z1",
  "distanceKm": 9,
  "durationMin": 60,
  "steps": [
    { "label": "Aquecimento", "distanceKm": 2, "intensity": "Z1", "kind": "aquecimento" },
    { "label": "500m Z2", "repeat": 7, "distanceKm": 0.5, "intensity": "Z2", "kind": "bloco" },
    { "label": "500m Z1", "repeat": 7, "distanceKm": 0.5, "intensity": "Z1", "kind": "recuperacao" }
  ]
}`;

export default async function CorosPage() {
  const todayIso = getTodayIsoDate();
  const [todayWorkoutResult, nextWorkouts, sisrunResult, activities, athlete] = await Promise.all([
    getStructuredPlannedWorkout(todayIso),
    getAllStructuredPlannedWorkouts(),
    getSisrunDataWithSource(),
    getStravaActivities({ after: STRAVA_2024_START_EPOCH, maxPages: 20 }),
    getStravaAthlete(),
  ]);

  const sisrunSummary = buildSisrunFallbackWorkoutSummary(sisrunResult.data);
  const savedWorkouts = nextWorkouts.filter(
    (result): result is typeof result & { data: StructuredPlannedWorkout } => Boolean(result.data),
  );
  const gears = buildGearRecommendationSummaries(activities, Array.isArray(athlete?.shoes) ? athlete.shoes as StravaGear[] : []);
  const completedWorkoutDates = new Set(
    activities
      .filter((activity) => isRunActivity(activity))
      .map((activity) => (activity.start_date_local ?? activity.start_date ?? "").slice(0, 10))
      .filter(Boolean),
  );
  const todayCompleted = completedWorkoutDates.has(todayIso);

  const recommendationByDate = new Map(
    savedWorkouts.map((result) => {
      const workout = getEquipmentWorkoutFromStructuredWorkout(result.data);
      const recommendation = pickRecommendedShoeForWorkout(gears, workout);
      return [result.data.date, recommendation?.name ?? null] as const;
    }),
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
            background: todayWorkoutResult.data
              ? (todayCompleted
                  ? "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(255,255,255,0.025))"
                  : "linear-gradient(180deg, rgba(59,130,246,0.14), rgba(255,255,255,0.025))")
              : undefined,
            border: todayWorkoutResult.data
              ? (todayCompleted
                  ? "1px solid rgba(16,185,129,0.24)"
                  : "1px solid rgba(59,130,246,0.28)")
              : undefined,
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
          <p className="ba-eyebrow">Todos os treinos</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Treinos estruturados salvos</h2>
          <CorosSavedWorkoutsList
            todayDate={todayIso}
            workouts={savedWorkouts.map((result) => ({
              redisKey: result.key,
              date: result.data.date,
              dateLabel: formatPlannedWorkoutDateWithWeekdayLabel(result.data.date),
              title: result.data.title,
              sourceLabel: getStructuredWorkoutSourceLabel(result.data.source),
              type: result.data.type,
              shoeName: recommendationByDate.get(result.data.date) ?? null,
              distanceKm: result.data.distanceKm ?? null,
              completed: completedWorkoutDates.has(result.data.date),
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
        {workout.durationMin ? ` · ${workout.durationMin} min` : ""}
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

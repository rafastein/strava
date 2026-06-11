export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import {
  buildSisrunFallbackWorkoutSummary,
  formatPlannedWorkoutDateLabel,
  getStructuredPlannedWorkout,
  getStructuredPlannedWorkoutsForRange,
  getStructuredWorkoutSourceLabel,
  getTodayIsoDate,
  PLANNED_WORKOUT_KEY_PREFIX,
  type StructuredPlannedWorkout,
} from "../lib/planned-workout";
import { getSisrunDataWithSource } from "../lib/sisrun-utils";

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
  const [todayWorkoutResult, nextWorkouts, sisrunResult] = await Promise.all([
    getStructuredPlannedWorkout(todayIso),
    getStructuredPlannedWorkoutsForRange(30),
    getSisrunDataWithSource(),
  ]);

  const sisrunSummary = buildSisrunFallbackWorkoutSummary(sisrunResult.data);

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

        <section className="grid gap-4 md:grid-cols-3">
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

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
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
          <p className="ba-eyebrow">Próximos 30 dias</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Treinos estruturados salvos</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {nextWorkouts.map((result) => (
              <div key={result.key} className="ba-card-soft" style={{ padding: "1rem" }}>
                <p className="ba-label">{formatPlannedWorkoutDateLabel(result.key.replace(PLANNED_WORKOUT_KEY_PREFIX, ""))}</p>
                {result.data ? (
                  <>
                    <p style={{ marginTop: 6, fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{result.data.title}</p>
                    <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>{getStructuredWorkoutSourceLabel(result.data.source)} · {result.data.type}</p>
                  </>
                ) : (
                  <p className="ba-muted" style={{ marginTop: 6, fontSize: 12 }}>Sem treino estruturado.</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
          <p className="ba-eyebrow">Entrada provisória</p>
          <h2 className="ba-title" style={{ fontSize: "1.7rem", marginTop: 4 }}>Como salvar um treino estruturado</h2>
          <p className="ba-muted" style={{ marginTop: ".5rem" }}>
            Enquanto a automação pelo MCP não roda dentro da Vercel, a rota protegida abaixo permite gravar um treino ou importar a agenda COROS em lote no mesmo formato que a página vai consumir.
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
  "entries": [
    { "date": "2026-06-13", "title": "Longão 23k", "distanceKm": 23, "estimatedTime": "2:07:33", "loadTl": 203 }
  ]
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

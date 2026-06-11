export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import BrandIcon from "../components/BrandIcon";
import {
  getStravaActivities,
  getStravaAthlete,
  isRunActivity,
  STRAVA_2024_START_EPOCH,
  type StravaActivitySummary,
  type StravaGear,
} from "../lib/strava-client";
import { formatBRDate } from "../lib/date-utils";
import { formatEfficiency, formatLongRunPace } from "../lib/strava-long-runs";
import ShoeUsageChart from "../components/ShoeUsageChart";
import { getSisrunDataWithSource } from "../lib/sisrun-utils";
import {
  EQUIPMENT_RECOMMENDATION_TYPES,
  KNOWN_GEAR_NAME_FALLBACKS,
  getShoeMaxKm,
  getTodayEquipmentWorkout,
  getWorkoutLabel,
  inferBrand,
  pickRecommendedShoeForWorkout,
  scoreShoeForWorkout,
  type EquipmentWorkout,
  type EquipmentWorkoutType,
  type GearForRecommendation,
  type ShoeRecommendation,
} from "../lib/equipment-recommendation";

type StravaActivity = StravaActivitySummary;

type GearSummary = GearForRecommendation & {
  gearId: string;
  totalTime: number;
  totalElevation: number;
  activities: number;
  heartRates: number[];
  efficiencies: number[];
  lastUse: string;
};

async function getAthleteGear(): Promise<StravaGear[]> {
  const athlete = await getStravaAthlete();
  return Array.isArray(athlete?.shoes) ? athlete.shoes : [];
}

async function getActivities(): Promise<StravaActivity[]> {
  return getStravaActivities({ after: STRAVA_2024_START_EPOCH, maxPages: 20 });
}

function calculateEfficiency(
  distanceKm: number,
  movingTimeSec: number,
  averageHeartrate: number | null | undefined,
  elevationGain: number
) {
  if (!distanceKm || !movingTimeSec || !averageHeartrate) return null;

  const rawSpeedKmh = distanceKm / (movingTimeSec / 3600);
  const elevationFactor =
    elevationGain > 0 ? 1 + elevationGain / (distanceKm * 100) : 1;

  return ((rawSpeedKmh * elevationFactor) / averageHeartrate) * 1000;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function getWearStatus(totalKm: number, maxKm: number) {
  const ratio = totalKm / maxKm;

  if (ratio >= 1) {
    return {
      label: "Muito rodado. Atenção alta",
      emoji: "🔴",
      tone: "bg-red-100 text-red-700",
      progress: 100,
    };
  }

  if (ratio >= 0.75) {
    return {
      label: "Bem rodado. Monitorar desgaste",
      emoji: "🟡",
      tone: "bg-amber-100 text-amber-700",
      progress: Math.min(ratio * 100, 100),
    };
  }

  if (ratio >= 0.4) {
    return {
      label: "Rodado, mas saudável",
      emoji: "🔵",
      tone: "bg-blue-100 text-blue-700",
      progress: Math.min(ratio * 100, 100),
    };
  }

  return {
    label: "Novo / confortável",
    emoji: "🟢",
    tone: "bg-emerald-100 text-emerald-700",
    progress: Math.min(ratio * 100, 100),
  };
}

function buildInitialGearSummary(gearId: string, name: string, brandName?: string | null): GearSummary {
  return {
    gearId,
    name,
    brand: inferBrand(name, brandName),
    totalKm: 0,
    maxKm: getShoeMaxKm(name),
    totalTime: 0,
    totalElevation: 0,
    activities: 0,
    heartRates: [],
    efficiencies: [],
    lastUse: "",
  };
}

function buildGearSummaries(
  activities: StravaActivity[],
  athleteGear: StravaGear[],
): GearSummary[] {
  const athleteGearById = new Map(athleteGear.map((gear) => [gear.id, gear]));
  const gearNameLookup: Record<string, string> = { ...KNOWN_GEAR_NAME_FALLBACKS };
  const stravaGearDistanceKm: Record<string, number> = {};

  athleteGear.forEach((gear) => {
    gearNameLookup[gear.id] = KNOWN_GEAR_NAME_FALLBACKS[gear.id] ?? gear.name;
    stravaGearDistanceKm[gear.id] = (gear.distance ?? 0) / 1000;
  });

  const allGearIds = new Set([
    ...Object.keys(KNOWN_GEAR_NAME_FALLBACKS),
    ...athleteGear.map((gear) => gear.id),
  ]);

  const grouped = new Map<string, GearSummary>();

  allGearIds.forEach((gearId) => {
    const stravaGear = athleteGearById.get(gearId);
    const name = gearNameLookup[gearId] ?? stravaGear?.name ?? gearId;
    grouped.set(gearId, buildInitialGearSummary(gearId, name, stravaGear?.brand_name));
  });

  activities
    .filter((activity) => isRunActivity(activity) && activity.gear_id && allGearIds.has(activity.gear_id))
    .forEach((activity) => {
      const gearId = activity.gear_id as string;
      const distanceKm = activity.distance / 1000;
      const item = grouped.get(gearId);
      if (!item) return;

      item.totalKm += distanceKm;
      item.totalTime += activity.moving_time;
      item.totalElevation += activity.total_elevation_gain ?? 0;
      item.activities += 1;

      if (activity.average_heartrate) {
        item.heartRates.push(activity.average_heartrate);
      }

      const efficiency = calculateEfficiency(
        distanceKm,
        activity.moving_time,
        activity.average_heartrate,
        activity.total_elevation_gain ?? 0
      );

      if (efficiency) {
        item.efficiencies.push(efficiency);
      }

      const activityDate = activity.start_date_local ?? activity.start_date;
      if (!item.lastUse || new Date(activityDate) > new Date(item.lastUse)) {
        item.lastUse = activityDate;
      }
    });

  grouped.forEach((gear) => {
    const stravaTotalKm = stravaGearDistanceKm[gear.gearId] ?? 0;
    gear.totalKm = Number(Math.max(gear.totalKm, stravaTotalKm).toFixed(1));
  });

  return Array.from(grouped.values())
    .filter((gear) => gear.activities > 0 || gear.totalKm > 0 || athleteGearById.has(gear.gearId))
    .sort((a, b) => b.totalKm - a.totalKm);
}

function getRecommendationAlternatives(
  gears: GearSummary[],
  workoutType: EquipmentWorkoutType | null,
  selectedGearId?: string,
) {
  if (!workoutType) return [];

  return gears
    .map((gear) => ({
      ...gear,
      recommendationScore: scoreShoeForWorkout(gear, workoutType).score,
    }))
    .filter((gear) => gear.gearId !== selectedGearId && gear.recommendationScore > -200)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 2);
}

export default async function EquipamentosPage() {
  const [activities, athleteGear, sisrunResult] = await Promise.all([
    getActivities(),
    getAthleteGear(),
    getSisrunDataWithSource(),
  ]);

  const grouped = buildGearSummaries(activities, athleteGear);
  const todayWorkout = getTodayEquipmentWorkout(sisrunResult.data);
  const todayShoe = pickRecommendedShoeForWorkout(grouped, todayWorkout);
  const todayAlternatives = getRecommendationAlternatives(
    grouped,
    todayWorkout.type,
    todayShoe?.gearId,
  );

  return (
    <div className="page"><Navbar />
    <main className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Strava + SisRUN</p>
            <h1 className="ba-title">Equipamentos</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Quilometragem, desgaste, eficiência e recomendação dinâmica de tênis a partir do treino planejado.
            </p>
          </div>
          <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
        </div>

        <TodayShoeCard
          workout={todayWorkout}
          shoe={todayShoe}
          alternatives={todayAlternatives}
          sisrunSource={sisrunResult.sourceLabel}
        />

        {grouped.length === 0 ? (
          <section className="ba-card" style={{ padding: "1.5rem" }}>
            <p className="ba-muted">Nenhuma atividade com equipamento válido foi encontrada.</p>
          </section>
        ) : (
          <>
            <section className="ba-section">
              <ShoeUsageChart
                shoes={grouped.map((g) => ({
                  name: g.name,
                  totalKm: g.totalKm,
                  maxKm: g.maxKm,
                  lastUse: g.lastUse,
                  activities: g.activities,
                }))}
              />
            </section>

            <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
              <p className="ba-eyebrow">Motor de recomendação</p>
              <h2 className="ba-title" style={{ fontSize: "1.8rem", marginTop: 4 }}>Tênis por tipo de treino</h2>
              <p className="ba-muted" style={{ marginTop: ".4rem" }}>
                Sugestão calculada pelo perfil do modelo, tipo do treino e desgaste acumulado. Tênis de prova são preservados automaticamente quando o dia não é prova/simulado.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                {EQUIPMENT_RECOMMENDATION_TYPES.map((type) => {
                  const syntheticWorkout: EquipmentWorkout = {
                    status: "planned",
                    type,
                    label: getWorkoutLabel(type),
                    dateLabel: "",
                    distanceKm: null,
                    source: "none",
                    evidence: [],
                  };
                  const shoe = pickRecommendedShoeForWorkout(grouped, syntheticWorkout);

                  return (
                    <div key={type} className="ba-card-soft" style={{ padding: "1rem" }}>
                      <p className="ba-label">
                        {getWorkoutLabel(type)}
                      </p>

                      {shoe ? (
                        <div className="mt-2 flex items-center gap-3">
                          <BrandIcon brand={shoe.brand} />
                          <div>
                            <p style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>
                              {shoe.name}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {shoe.totalKm.toFixed(0)} km acumulados
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="ba-muted" style={{ marginTop: 8 }}>Sem sugestão disponível.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {grouped.map((gear) => {
                const averagePace =
                  gear.totalKm > 0 ? gear.totalTime / gear.totalKm : null;

                const averageKmPerRun =
                  gear.activities > 0 ? gear.totalKm / gear.activities : 0;

                const averageHr =
                  gear.heartRates.length > 0
                    ? gear.heartRates.reduce((a, b) => a + b, 0) /
                      gear.heartRates.length
                    : null;

                const averageEfficiency =
                  gear.efficiencies.length > 0
                    ? gear.efficiencies.reduce((a, b) => a + b, 0) /
                      gear.efficiencies.length
                    : null;

                const wear = getWearStatus(gear.totalKm, gear.maxKm);

                return (
                  <article key={gear.gearId} className="ba-card" style={{ padding: "1.5rem" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <BrandIcon brand={gear.brand} />
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                          {gear.name}
                        </h2>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${wear.tone}`}
                      >
                        {wear.emoji} {wear.label}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <Metric
                        label="Km total"
                        value={`${gear.totalKm.toFixed(1)} km`}
                      />
                      <Metric label="Treinos" value={String(gear.activities)} />
                      <Metric
                        label="Média por corrida"
                        value={`${averageKmPerRun.toFixed(1)} km`}
                      />
                      <Metric label="Tempo" value={formatDuration(gear.totalTime)} />
                      <Metric
                        label="Pace médio"
                        value={formatLongRunPace(averagePace)}
                      />
                      <Metric
                        label="FC média"
                        value={averageHr ? `${averageHr.toFixed(0)} bpm` : "-"}
                      />
                      <Metric
                        label="Eficiência"
                        value={formatEfficiency(averageEfficiency)}
                      />
                      <Metric
                        label="Elevação"
                        value={`${gear.totalElevation.toFixed(0)} m`}
                      />
                      <Metric label="Último uso" value={gear.lastUse ? formatBRDate(gear.lastUse) : "-"} />
                    </div>

                    <div className="mt-4">
                      <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                        <span>Desgaste estimado</span>
                        <span>{gear.totalKm.toFixed(0)} / {gear.maxKm} km</span>
                      </div>

                      <div className="ba-progress">
                        <div
                          className="ba-progress-fill"
                          style={{ width: `${wear.progress}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
    </main>
    <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

function TodayShoeCard({
  workout,
  shoe,
  alternatives,
  sisrunSource,
}: {
  workout: EquipmentWorkout;
  shoe: ShoeRecommendation | null;
  alternatives: GearSummary[];
  sisrunSource: string;
}) {
  const isRest = workout.status === "rest";
  const isUnknown = workout.status === "unknown";

  return (
    <section className="ba-section ba-card" style={{ padding: "1.5rem" }}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="ba-eyebrow">Treino de hoje</p>
          <h2 className="ba-title" style={{ fontSize: "1.9rem", marginTop: 4 }}>
            {isRest ? "Descanso" : isUnknown ? "Sem treino carregado" : workout.label}
          </h2>
          <p className="ba-muted" style={{ marginTop: ".45rem" }}>
            {isRest
              ? "Nenhum tênis recomendado hoje. Melhor preservar o rodízio."
              : isUnknown
                ? "Não encontrei treino do dia no SisRUN carregado."
                : `${
                    typeof workout.distanceKm === "number" && workout.distanceKm > 0
                      ? `${workout.distanceKm.toFixed(1)} km planejados`
                      : "Distância não informada no SisRUN"
                  } · fonte: ${sisrunSource}`}
          </p>

          {workout.evidence.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {workout.evidence.slice(0, 4).map((item) => (
                <span key={item} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="ba-card-soft" style={{ padding: "1rem", minWidth: 280 }}>
          <p className="ba-label">Tênis recomendado</p>

          {shoe ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <BrandIcon brand={shoe.brand} />
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.15 }}>
                    {shoe.name}
                  </p>
                  <p style={{ marginTop: 3, fontSize: 12, color: "var(--text-muted)" }}>
                    {shoe.totalKm.toFixed(0)} / {shoe.maxKm} km · score {shoe.recommendationScore}
                  </p>
                </div>
              </div>

              <p className="ba-muted" style={{ marginTop: ".85rem", fontSize: 13 }}>
                {shoe.profile.notes}
              </p>

              <ul style={{ marginTop: ".85rem", paddingLeft: "1rem", color: "var(--text-muted)", fontSize: 12 }}>
                {shoe.reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              {alternatives.length > 0 && (
                <p style={{ marginTop: ".85rem", fontSize: 12, color: "var(--text-muted)" }}>
                  Alternativas: {alternatives.map((alt) => alt.name).join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="ba-muted" style={{ marginTop: ".75rem" }}>
              {isRest
                ? "Dia sem treino. Sem desgaste necessário no rodízio."
                : "Não há tênis suficiente no histórico para recomendar com segurança."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ba-card-soft" style={{ padding: ".75rem 1rem" }}>
      <p className="ba-label">{label}</p>
      <p style={{ marginTop: 4, fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{value}</p>
    </div>
  );
}

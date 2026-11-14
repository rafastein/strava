// Sempre renderiza na hora; só as chamadas ao Strava usam o cache de dados (lib/strava-client).
export const revalidate = 0;

import Link from "next/link";
import Navbar from "../components/Navbar";
import BrandIcon from "../components/BrandIcon";
import {
  getStravaActivities,
  getStravaAthlete,
  STRAVA_2024_START_EPOCH,
  type StravaActivitySummary,
  type StravaGear,
} from "../lib/strava-client";
import { summarizeEquipmentActivities } from "../lib/equipment-activity-summary";
import {
  formatEquipmentPrice,
  formatEquipmentPurchaseDate,
  formatEquipmentAge,
  formatEstimatedPricePerKm,
  formatEstimatedRuns,
  formatPricePerKm,
  formatPricePerRun,
  getEquipmentPurchaseMetadata,
} from "../lib/equipment-metadata";
import { getBRDateKey } from "../lib/date-utils";
import { formatDayMonth, formatKm, formatNumber } from "../lib/format";
import { sortEquipmentByName } from "../lib/equipment-sort";
import { formatLongRunPace } from "../lib/strava-long-runs";
import { getSisrunDataWithSource } from "../lib/sisrun-utils";
import { getStructuredPlannedWorkout } from "../lib/planned-workout";
import {
  EQUIPMENT_RECOMMENDATION_TYPES,
  KNOWN_GEAR_NAME_FALLBACKS,
  getEquipmentWorkoutFromStructuredWorkout,
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
import { getCurrentSeasonYear } from "../lib/season";

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

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function getWearStatus(totalKm: number, maxKm: number) {
  const ratio = maxKm > 0 ? totalKm / maxKm : 0;
  const progress = Math.min(Math.max(ratio * 100, 0), 100);

  if (ratio >= 1) return { label: "Passou do limite", color: "#ff8a7a", progress: 100 };
  if (ratio >= 0.75) return { label: "Bem rodado, monitorar", color: "var(--ui-accent)", progress };
  if (ratio >= 0.4) return { label: "Rodado, saudável", color: "var(--ui-blue)", progress };
  return { label: "Novo", color: "var(--ui-good)", progress };
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

  athleteGear.forEach((gear) => {
    gearNameLookup[gear.id] = KNOWN_GEAR_NAME_FALLBACKS[gear.id] ?? gear.name;
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

  const activityStatsByGear = summarizeEquipmentActivities(activities);

  activityStatsByGear.forEach((stats, gearId) => {
    if (!allGearIds.has(gearId)) return;

    const item = grouped.get(gearId);
    if (!item) return;

    item.totalKm = stats.totalKm;
    item.totalTime = stats.totalTime;
    item.totalElevation = stats.totalElevation;
    item.activities = stats.activities;
    item.heartRates = stats.heartRates;
    item.efficiencies = stats.efficiencies;
    item.lastUse = stats.lastUse;
  });

  return sortEquipmentByName(
    Array.from(grouped.values()).filter(
      (gear) => gear.activities > 0 || gear.totalKm > 0 || athleteGearById.has(gear.gearId),
    ),
  );
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
  const [activities, athleteGear, sisrunResult, structuredWorkoutResult] = await Promise.all([
    getActivities(),
    getAthleteGear(),
    getSisrunDataWithSource(),
    getStructuredPlannedWorkout(),
  ]);

  const grouped = buildGearSummaries(activities, athleteGear);
  const todayWorkout = structuredWorkoutResult.data
    ? getEquipmentWorkoutFromStructuredWorkout(structuredWorkoutResult.data)
    : getTodayEquipmentWorkout(sisrunResult.data);
  const todayShoe = pickRecommendedShoeForWorkout(grouped, todayWorkout);
  const todayAlternatives = getRecommendationAlternatives(
    grouped,
    todayWorkout.type,
    todayShoe?.gearId,
  );

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Tênis</h1>
            <p className="ui-muted">
              {grouped.length} {grouped.length === 1 ? "par" : "pares"} no rodízio · desgaste, custo e recomendação por treino
            </p>
          </div>
        </header>

        <div className="hoje-col">
          <TodayShoeCard
            workout={todayWorkout}
            shoe={todayShoe}
            alternatives={todayAlternatives}
            workoutSource={structuredWorkoutResult.data ? structuredWorkoutResult.sourceLabel : sisrunResult.sourceLabel}
          />

          {grouped.length === 0 ? (
            <p className="ui-card ui-card--pad ui-muted">Nenhuma atividade com tênis cadastrado foi encontrada no Strava.</p>
          ) : (
            <>
              {/* ── Rodízio ── */}
              <section className="ui-section" aria-label="Rodízio">
                <div className="ui-section__head">
                  <h2 className="ui-h2">Rodízio</h2>
                  <span className="ui-muted">toque para ver uso e custo</span>
                </div>
                <div className="ui-card ui-list">
                  {grouped.map((gear) => {
                    const averagePace = gear.totalKm > 0 ? gear.totalTime / gear.totalKm : null;
                    const averageKmPerRun = gear.activities > 0 ? gear.totalKm / gear.activities : 0;
                    const averageHr = gear.heartRates.length > 0
                      ? gear.heartRates.reduce((a, b) => a + b, 0) / gear.heartRates.length
                      : null;
                    const averageEfficiency = gear.efficiencies.length > 0
                      ? gear.efficiencies.reduce((a, b) => a + b, 0) / gear.efficiencies.length
                      : null;
                    const wear = getWearStatus(gear.totalKm, gear.maxKm);
                    const purchase = getEquipmentPurchaseMetadata(gear.name);
                    const lastUseKey = gear.lastUse ? getBRDateKey(gear.lastUse) : "";

                    return (
                      <details key={gear.gearId} className="ui-acc">
                        <summary className="ui-row" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}>
                          <BrandBadge brand={gear.brand} />
                          <span className="ui-row__main" style={{ flex: 1, gap: 6 }}>
                            <span className="ui-row__title">{gear.name}</span>
                            <span className="tenis-wear" role="img" aria-label={`${formatNumber(wear.progress)}% da vida útil estimada`}>
                              <span className="tenis-wear__fill" style={{ width: `${wear.progress}%`, background: wear.color }} />
                            </span>
                            <span className="ui-muted" style={{ fontSize: 12 }}>
                              <span style={{ color: wear.color, fontWeight: 600 }}>{wear.label}</span>
                              {lastUseKey ? ` · último uso ${formatDayMonth(lastUseKey)}` : ""}
                            </span>
                          </span>
                          <span className="ui-row__side">
                            <span className="ui-row__value">{formatKm(gear.totalKm, 0)}</span>
                            <span className="ui-muted">de {formatNumber(gear.maxKm)}</span>
                          </span>
                        </summary>
                        <div className="ui-acc__body">
                          <dl className="ui-dl">
                            <div><dt>Corridas</dt><dd>{formatNumber(gear.activities)}</dd></div>
                            <div><dt>Média por corrida</dt><dd>{formatKm(averageKmPerRun)}</dd></div>
                            <div><dt>Tempo total</dt><dd>{formatDuration(gear.totalTime)}</dd></div>
                            <div><dt>Pace médio</dt><dd>{formatLongRunPace(averagePace)}</dd></div>
                            <div><dt>FC média</dt><dd>{averageHr ? `${formatNumber(averageHr)} bpm` : "—"}</dd></div>
                            <div><dt>Eficiência</dt><dd>{averageEfficiency ? formatNumber(averageEfficiency, 1) : "—"}</dd></div>
                            <div><dt>Subida acumulada</dt><dd>{formatNumber(gear.totalElevation)} m</dd></div>
                            <div><dt>Corridas até o limite</dt><dd>{formatEstimatedRuns(gear.maxKm, averageKmPerRun)}</dd></div>
                          </dl>
                          <dl className="ui-dl" style={{ paddingTop: 14, borderTop: "1px solid var(--ui-border)" }}>
                            <div><dt>Preço</dt><dd>{formatEquipmentPrice(purchase?.priceBRL)}</dd></div>
                            <div><dt>Comprado em</dt><dd>{formatEquipmentPurchaseDate(purchase?.purchaseDate)}</dd></div>
                            <div><dt>Idade</dt><dd>{formatEquipmentAge(purchase?.purchaseDate)}</dd></div>
                            <div><dt>Custo por km até agora</dt><dd>{formatPricePerKm(purchase?.priceBRL, gear.totalKm)}</dd></div>
                            <div><dt>Custo por corrida</dt><dd>{formatPricePerRun(purchase?.priceBRL, gear.activities)}</dd></div>
                            <div><dt>Custo por km no fim da vida</dt><dd>{formatEstimatedPricePerKm(purchase?.priceBRL, gear.maxKm)}</dd></div>
                          </dl>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>

              {/* ── Por tipo de treino ── */}
              <section className="ui-section" aria-label="Tênis por tipo de treino">
                <div className="ui-section__head">
                  <h2 className="ui-h2">Por tipo de treino</h2>
                </div>
                <div className="ui-card ui-list">
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
                      <div key={type} className="ui-row" style={{ minHeight: 56 }}>
                        <span className="ui-muted" style={{ fontSize: 14, color: "var(--ui-text-2)" }}>{getWorkoutLabel(type)}</span>
                        <span className="ui-row__side">
                          <span style={{ fontSize: 15, fontWeight: 600, textAlign: "right" }}>{shoe ? shoe.name : "sem sugestão"}</span>
                          {shoe ? <span className="ui-muted" style={{ fontSize: 12 }}>{formatKm(shoe.totalKm, 0)} rodados</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="ui-muted" style={{ padding: "0 4px" }}>
                  A sugestão combina o perfil do modelo, o tipo do treino, o desgaste e o tempo sem uso. Tênis de prova
                  ficam preservados fora de dia de prova.
                </p>
              </section>
            </>
          )}
        </div>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · {getCurrentSeasonYear()}</footer>
    </div>
  );
}

function BrandBadge({ brand }: { brand?: string }) {
  // Fundo claro: várias marcas têm logo preto, que some no tema escuro.
  return (
    <span className="tenis-brand" aria-hidden="true">
      <BrandIcon brand={brand} className="h-5 w-5" />
    </span>
  );
}

function TodayShoeCard({
  workout,
  shoe,
  alternatives,
  workoutSource,
}: {
  workout: EquipmentWorkout;
  shoe: ShoeRecommendation | null;
  alternatives: GearSummary[];
  workoutSource: string;
}) {
  const isRest = workout.status === "rest";
  const isUnknown = workout.status === "unknown";
  const planned = typeof workout.distanceKm === "number" && workout.distanceKm > 0 ? `${formatKm(workout.distanceKm)} planejados` : null;

  return (
    <section className="ui-card ui-card--pad ui-stack" aria-label="Tênis de hoje">
      <p className="ui-label-accent">Hoje</p>
      <div>
        <h2 className="hoje-race__title" style={{ fontSize: 22 }}>
          {isRest ? "Descanso" : isUnknown ? "Sem treino carregado" : workout.label}
        </h2>
        <p className="ui-muted" style={{ fontSize: 14, marginTop: 4 }}>
          {isRest
            ? "Nenhum tênis recomendado hoje; o rodízio descansa."
            : isUnknown
              ? "Não há treino do COROS nem do SisRUN para hoje."
              : [planned, `fonte: ${workoutSource}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      {shoe ? (
        <div className="ui-stack" style={{ gap: 12, paddingTop: 16, borderTop: "1px solid var(--ui-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BrandBadge brand={shoe.brand} />
            <div style={{ minWidth: 0 }}>
              <p className="ui-muted" style={{ fontSize: 12 }}>Tênis recomendado</p>
              <p className="ui-num" style={{ fontSize: 20 }}>{shoe.name}</p>
              <p className="ui-muted">{formatKm(shoe.totalKm, 0)} de {formatNumber(shoe.maxKm)} km</p>
            </div>
          </div>
          {shoe.profile.notes ? <p style={{ fontSize: 14, color: "var(--ui-text-2)" }}>{shoe.profile.notes}</p> : null}
          {shoe.reasons.length > 0 ? (
            <ul style={{ paddingLeft: 18, fontSize: 14, color: "var(--ui-text-2)", display: "flex", flexDirection: "column", gap: 4 }}>
              {shoe.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {alternatives.length > 0 ? (
            <p className="ui-muted">Alternativas: {alternatives.map((alt) => alt.name).join(" · ")}</p>
          ) : null}
        </div>
      ) : !isRest && !isUnknown ? (
        <p className="ui-muted" style={{ fontSize: 14 }}>Ainda não há histórico suficiente para recomendar um tênis com segurança.</p>
      ) : null}

      <Link href="/coros" className="ui-btn ui-btn--ghost">Ver agenda de treinos</Link>
    </section>
  );
}

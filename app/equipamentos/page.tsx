export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import BrandIcon from "../components/BrandIcon";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { formatBRDate } from "../lib/date-utils";
import { formatEfficiency, formatLongRunPace } from "../lib/strava-long-runs";
import ShoeUsageChart from "../components/ShoeUsageChart";

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  gear_id?: string | null;
  start_date: string;
  start_date_local: string;
};

type WorkoutType =
  | "regenerativo"
  | "rodagem"
  | "intervalado"
  | "fartlek"
  | "ritmo"
  | "longao"
  | "prova_curta"
  | "prova_longa";

type GearSummary = {
  gearId: string;
  name: string;
  brand: string;
  totalKm: number;
  maxKm: number;
  totalTime: number;
  totalElevation: number;
  activities: number;
  heartRates: number[];
  efficiencies: number[];
  lastUse: string;
};

const GEAR_NAMES: Record<string, string> = {
  g21807495: "ASICS Novablast 4",
  g24261597: "PUMA Deviate Nitro 3",
  g19907684: "On Cloudsurfer Next",
  g25620324: "New Balance SC Elite",
  g22477361: "Adidas Boston 12",
  g24432359: "Adidas Evo SL",
  g27836945: "ASICS Superblast 2",
  g29703820: "Adidas Adios Pro 4",
  g22897245: "361 Flame RS",
  g29162176: "Fila Skytrail",
};

// Vida útil estimada por modelo (km) baseada em reviews especializados:
// Novablast 4:    outsole AHAR+ mais espesso → 800 km
// Deviate Nitro 3: NITRO foam + outsole robusto → 700 km
// Cloudsurfer Next: CloudTec robusto para treino diário → 700 km
// SC Elite:       tênis de prova, FuelCell exposta → 400 km
// Boston 12:      treino rápido durável → 700 km
// Evo SL:         Continental rubber, Lightstrike Pro → 800 km
// Superblast 2:   ASICSGRIP + FF Blast Turbo → 800 km
// Adios Pro 4:    tênis de prova com rods → 500 km
// 361 Flame RS:   treino diário, outsole robusto → 700 km
// Fila Skytrail:  trail, outsole para terreno → 600 km
const GEAR_MAX_KM: Record<string, number> = {
  g21807495: 800, // ASICS Novablast 4
  g24261597: 700, // PUMA Deviate Nitro 3
  g19907684: 700, // On Cloudsurfer Next
  g25620324: 400, // New Balance SC Elite
  g22477361: 700, // Adidas Boston 12
  g24432359: 800, // Adidas Evo SL
  g27836945: 800, // ASICS Superblast 2
  g29703820: 500, // Adidas Adios Pro 4
  g22897245: 700, // 361 Flame RS
  g29162176: 600, // Fila Skytrail
};

const VALID_GEAR_IDS = new Set(Object.keys(GEAR_NAMES));

const STRAVA_AFTER_EPOCH = Math.floor(
  new Date("2024-01-01T00:00:00Z").getTime() / 1000
);

function extractBrand(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("adidas")) return "adidas";
  if (lower.includes("puma")) return "puma";
  if (lower.includes("asics")) return "asics";
  if (lower.includes("new balance")) return "new balance";
  if (lower.includes("fila")) return "fila";
  if (lower.includes("361")) return "361";
  if (lower.includes("on ")) return "on";

  return name.split(" ")[0];
}

type StravaGear = {
  id: string;
  name: string;
  distance: number; // meters
};

async function getAthleteGear(): Promise<StravaGear[]> {
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return [];
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const athlete = await res.json();
    return (athlete.shoes ?? []) as StravaGear[];
  } catch { return []; }
}

async function getActivities(): Promise<StravaActivity[]> {
  const token = await getValidStravaAccessToken();
  if (!token) return [];

  const all: StravaActivity[] = [];
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("after", String(STRAVA_AFTER_EPOCH));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) break;

    const data = (await res.json()) as StravaActivity[];
    if (!Array.isArray(data) || data.length === 0) break;

    all.push(...data);

    if (data.length < perPage) break;
  }

  return all;
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

// maxKm é o limite real do tênis, variando por modelo
function getWearStatus(totalKm: number, maxKm: number) {
  const ratio = totalKm / maxKm;

  if (ratio >= 1) {
    return {
      label: "Muito rodado. Atenção alta",
      emoji: "🔴",
      tone: "bg-red-100 text-red-700",
      bar: "bg-red-500",
      progress: 100,
    };
  }

  if (ratio >= 0.75) {
    return {
      label: "Bem rodado. Monitorar desgaste",
      emoji: "🟡",
      tone: "bg-amber-100 text-amber-700",
      bar: "bg-amber-500",
      progress: Math.min(ratio * 100, 100),
    };
  }

  if (ratio >= 0.4) {
    return {
      label: "Rodado, mas saudável",
      emoji: "🔵",
      tone: "bg-blue-100 text-blue-700",
      bar: "bg-blue-500",
      progress: Math.min(ratio * 100, 100),
    };
  }

  return {
    label: "Novo / confortável",
    emoji: "🟢",
    tone: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    progress: Math.min(ratio * 100, 100),
  };
}

// Tênis reservados exclusivamente para provas — não devem aparecer em treinos
const RACE_ONLY_SHOES = ["adios pro", "sc elite"];

function isRaceOnly(name: string) {
  const n = name.toLowerCase();
  return RACE_ONLY_SHOES.some((s) => n.includes(s));
}

function scoreShoeForWorkout(
  name: string,
  totalKm: number,
  maxKm: number,
  workoutType: WorkoutType
) {
  const n = name.toLowerCase();
  const isRace = workoutType === "prova_curta" || workoutType === "prova_longa";

  // Tênis de prova não entram em recomendações de treino
  if (isRaceOnly(name) && !isRace) return -999;

  let score = 0;

  if (workoutType === "prova_curta") {
    // Até 10k: tênis mais rígidos e responsivos
    if (n.includes("sc elite"))  score += 100; // NB SC Elite — mais rígido, ideal para curtas
    if (n.includes("adios pro")) score += 90;  // Adios Pro 4 — funciona mas é mais maratona
  }

  if (workoutType === "prova_longa") {
    // Acima de 10k: amortecimento + placa de carbono
    if (n.includes("adios pro")) score += 100; // Adios Pro 4 — feito para meia/maratona
    if (n.includes("sc elite"))  score += 85;  // SC Elite também funciona em meias
  }

  if (workoutType === "intervalado") {
    if (n.includes("deviate"))    score += 100;
    if (n.includes("evo"))        score += 90;
    if (n.includes("superblast")) score += 80;
    if (n.includes("boston"))     score += 70;
  }

  if (workoutType === "fartlek") {
    // Fartlek: mistura de ritmos — tênis versátil com retorno de energia
    if (n.includes("deviate"))    score += 100; // Deviate Nitro 3 — responsivo e versátil
    if (n.includes("superblast")) score += 90;  // Superblast — amortecimento + velocidade
    if (n.includes("boston"))     score += 80;  // Boston 12 — clássico para variações de ritmo
    if (n.includes("evo"))        score += 75;  // Evo SL
  }

  if (workoutType === "ritmo") {
    if (n.includes("superblast")) score += 100;
    if (n.includes("deviate"))    score += 90;
    if (n.includes("boston"))     score += 85;
    if (n.includes("evo"))        score += 80;
  }

  if (workoutType === "longao") {
    if (n.includes("superblast")) score += 100;
    if (n.includes("deviate"))    score += 85;
    if (n.includes("novablast"))  score += 80;
    if (n.includes("boston"))     score += 70;
  }

  if (workoutType === "rodagem") {
    if (n.includes("novablast"))   score += 100;
    if (n.includes("boston"))      score += 85;
    if (n.includes("cloudsurfer")) score += 80;
    if (n.includes("361"))         score += 70;
    if (n.includes("evo"))         score += 65;
  }

  if (workoutType === "regenerativo") {
    if (n.includes("cloudsurfer")) score += 100;
    if (n.includes("novablast"))   score += 90;
    if (n.includes("361"))         score += 75;
    if (n.includes("fila"))        score += 65;
  }

  // Penalidade proporcional ao desgaste real de cada modelo
  const ratio = totalKm / maxKm;
  if (ratio >= 1)         score -= 80;
  else if (ratio >= 0.75) score -= 30;
  else if (ratio >= 0.4)  score -= 10;

  return score;
}

function getBestShoeForWorkout(gears: GearSummary[], workoutType: WorkoutType) {
  return [...gears]
    .map((gear) => ({
      ...gear,
      recommendationScore: scoreShoeForWorkout(
        gear.name,
        gear.totalKm,
        gear.maxKm,
        workoutType
      ),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)[0];
}

function getWorkoutLabel(type: WorkoutType) {
  const labels: Record<WorkoutType, string> = {
    regenerativo: "Regenerativo",
    rodagem:      "Rodagem",
    intervalado:  "Intervalado",
    fartlek:      "Fartlek",
    ritmo:        "Ritmo",
    longao:       "Longão",
    prova_curta:  "Prova Curta (≤ 10k)",
    prova_longa:  "Prova Longa (> 10k)",
  };

  return labels[type];
}

export default async function EquipamentosPage() {
  const [activities, athleteGear] = await Promise.all([
    getActivities(),
    getAthleteGear(),
  ]);

  // Merge hardcoded names with dynamic gear from Strava
  const dynamicGearNames: Record<string, string> = {};
  athleteGear.forEach((g) => {
    dynamicGearNames[g.id] = GEAR_NAMES[g.id] ?? g.name;
  });

  // All known gear IDs (hardcoded + dynamic)
  const allGearIds = new Set([
    ...Object.keys(GEAR_NAMES),
    ...athleteGear.map((g) => g.id),
  ]);

  const runs = activities.filter(
    (a) => a.type === "Run" && a.gear_id && allGearIds.has(a.gear_id)
  );

  const gearNameLookup = { ...GEAR_NAMES, ...dynamicGearNames };

  const grouped = Object.values(
    runs.reduce<Record<string, GearSummary>>((acc, activity) => {
      const gearId = activity.gear_id as string;
      const distanceKm = activity.distance / 1000;

      if (!acc[gearId]) {
        const name = gearNameLookup[gearId] ?? gearId;

        acc[gearId] = {
          gearId,
          name,
          brand: extractBrand(name),
          totalKm: 0,
          maxKm: GEAR_MAX_KM[gearId] ?? 600,
          totalTime: 0,
          totalElevation: 0,
          activities: 0,
          heartRates: [],
          efficiencies: [],
          lastUse: activity.start_date_local ?? activity.start_date,
        };
      }

      const item = acc[gearId];

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

      const currentDate = new Date(activity.start_date_local ?? activity.start_date);
      const lastDate = new Date(item.lastUse);

      if (currentDate > lastDate) {
        item.lastUse = activity.start_date_local ?? activity.start_date;
      }

      return acc;
    }, {})
  ).sort((a, b) => b.totalKm - a.totalKm);

  const recommendationTypes: WorkoutType[] = [
    "regenerativo",
    "rodagem",
    "longao",
    "fartlek",
    "ritmo",
    "intervalado",
    "prova_curta",
    "prova_longa",
  ];

  return (
    <div className="page"><Navbar />
    <main className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Strava</p>
            <h1 className="ba-title">Equipamentos</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>Quilometragem, desgaste, eficiência e recomendação automática de tênis por tipo de treino.</p>
          </div>
          <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
        </div>

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
              <p className="ba-eyebrow">Recomendação automática</p>
              <h2 className="ba-title" style={{ fontSize: "1.8rem", marginTop: 4 }}>Tênis por tipo de treino</h2>
              <p className="ba-muted" style={{ marginTop: ".4rem" }}>Sugestão baseada na função do tênis e na quilometragem acumulada.</p>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {recommendationTypes.map((type) => {
                  const shoe = getBestShoeForWorkout(grouped, type);

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
                      <Metric label="Último uso" value={formatBRDate(gear.lastUse)} />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ba-card-soft" style={{ padding: ".75rem 1rem" }}>
      <p className="ba-label">{label}</p>
      <p style={{ marginTop: 4, fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{value}</p>
    </div>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import BrandIcon from "../components/BrandIcon";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { formatBRDate } from "../lib/date-utils";
import { formatEfficiency, formatLongRunPace } from "../lib/strava-long-runs";

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
  | "ritmo"
  | "longao"
  | "prova";

type GearSummary = {
  gearId: string;
  name: string;
  brand: string;
  totalKm: number;
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

function getWearStatus(totalKm: number) {
  if (totalKm >= 600) {
    return {
      label: "Muito rodado. Atenção alta",
      emoji: "🔴",
      tone: "bg-red-100 text-red-700",
      bar: "bg-red-500",
      progress: 100,
    };
  }

  if (totalKm >= 350) {
    return {
      label: "Bem rodado. Monitorar desgaste",
      emoji: "🟡",
      tone: "bg-amber-100 text-amber-700",
      bar: "bg-amber-500",
      progress: Math.min((totalKm / 600) * 100, 100),
    };
  }

  if (totalKm >= 200) {
    return {
      label: "Rodado, mas saudável",
      emoji: "🔵",
      tone: "bg-blue-100 text-blue-700",
      bar: "bg-blue-500",
      progress: Math.min((totalKm / 600) * 100, 100),
    };
  }

  return {
    label: "Novo / confortável",
    emoji: "🟢",
    tone: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
    progress: Math.min((totalKm / 600) * 100, 100),
  };
}

function scoreShoeForWorkout(
  name: string,
  totalKm: number,
  workoutType: WorkoutType
) {
  let score = 0;
  const n = name.toLowerCase();

  if (workoutType === "prova") {
    if (n.includes("adios pro")) score += 100;
    if (n.includes("sc elite")) score += 95;
    if (n.includes("superblast")) score += 70;
  }

  if (workoutType === "intervalado") {
    if (n.includes("adios pro")) score += 95;
    if (n.includes("sc elite")) score += 90;
    if (n.includes("deviate")) score += 85;
    if (n.includes("evo")) score += 75;
  }

  if (workoutType === "ritmo") {
    if (n.includes("superblast")) score += 95;
    if (n.includes("deviate")) score += 90;
    if (n.includes("boston")) score += 85;
    if (n.includes("evo")) score += 80;
  }

  if (workoutType === "longao") {
    if (n.includes("superblast")) score += 100;
    if (n.includes("deviate")) score += 90;
    if (n.includes("novablast")) score += 80;
    if (n.includes("boston")) score += 75;
  }

  if (workoutType === "rodagem") {
    if (n.includes("novablast")) score += 95;
    if (n.includes("cloudsurfer")) score += 90;
    if (n.includes("boston")) score += 80;
    if (n.includes("evo")) score += 75;
  }

  if (workoutType === "regenerativo") {
    if (n.includes("cloudsurfer")) score += 100;
    if (n.includes("novablast")) score += 90;
    if (n.includes("superblast")) score += 70;
  }

  if (totalKm >= 600) score -= 80;
  else if (totalKm >= 350) score -= 30;
  else if (totalKm >= 200) score -= 10;

  return score;
}

function getBestShoeForWorkout(gears: GearSummary[], workoutType: WorkoutType) {
  return [...gears]
    .map((gear) => ({
      ...gear,
      recommendationScore: scoreShoeForWorkout(
        gear.name,
        gear.totalKm,
        workoutType
      ),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)[0];
}

function getWorkoutLabel(type: WorkoutType) {
  const labels: Record<WorkoutType, string> = {
    regenerativo: "Regenerativo",
    rodagem: "Rodagem",
    intervalado: "Intervalado",
    ritmo: "Ritmo",
    longao: "Longão",
    prova: "Prova",
  };

  return labels[type];
}

export default async function EquipamentosPage() {
  const activities = await getActivities();

  const runs = activities.filter(
    (a) => a.type === "Run" && a.gear_id && VALID_GEAR_IDS.has(a.gear_id)
  );

  const grouped = Object.values(
    runs.reduce<Record<string, GearSummary>>((acc, activity) => {
      const gearId = activity.gear_id as string;
      const distanceKm = activity.distance / 1000;

      if (!acc[gearId]) {
        const name = GEAR_NAMES[gearId];

        acc[gearId] = {
          gearId,
          name,
          brand: extractBrand(name),
          totalKm: 0,
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
    "ritmo",
    "intervalado",
    "prova",
  ];

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Strava</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Equipamentos
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Quilometragem, desgaste, eficiência e recomendação automática de
              tênis por tipo de treino.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {grouped.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Nenhuma atividade com equipamento válido foi encontrada.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">
                Recomendação automática
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Sugestão baseada na função do tênis e na quilometragem acumulada.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {recommendationTypes.map((type) => {
                  const shoe = getBestShoeForWorkout(grouped, type);

                  return (
                    <div key={type} className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {getWorkoutLabel(type)}
                      </p>

                      {shoe ? (
                        <div className="mt-2 flex items-center gap-3">
                          <BrandIcon brand={shoe.brand} />
                          <div>
                            <p className="font-semibold text-gray-900">
                              {shoe.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {shoe.totalKm.toFixed(0)} km acumulados
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">
                          Sem sugestão disponível.
                        </p>
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

                const wear = getWearStatus(gear.totalKm);

                return (
                  <article
                    key={gear.gearId}
                    className="rounded-3xl bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <BrandIcon brand={gear.brand} />
                        <h2 className="text-xl font-bold text-gray-900">
                          {gear.name}
                        </h2>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${wear.tone}`}
                      >
                        {wear.emoji} {wear.label}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
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
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>Desgaste estimado</span>
                        <span>{gear.totalKm.toFixed(0)} / 600 km</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${wear.bar}`}
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
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
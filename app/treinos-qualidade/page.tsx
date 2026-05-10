export const revalidate = 86400; // 24 horas

import Link from "next/link";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { getLongRunsFromActivities } from "../lib/strava-long-runs";
import QualityWorkoutsChart, {
  type QualityWorkout,
} from "../components/QualityWorkoutsChart";
import RevalidateButton from "../components/RevalidateButton";

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  start_date: string;
  start_date_local: string;
  average_speed?: number;
  max_speed?: number;
  calories?: number;
  splits_metric?: StravaSplit[];
};

type StravaSplit = {
  distance: number;
  moving_time: number;
  split: number;
  average_speed?: number;
  average_heartrate?: number | null;
};

const AFTER_EPOCH = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return [];
    const all: StravaActivity[] = [];
    for (let page = 1; page <= 15; page++) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}&after=${AFTER_EPOCH}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) break;
      const batch = (await res.json()) as StravaActivity[];
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 200) break;
    }
    return all;
  } catch { return []; }
}

async function getDetailedActivity(
  id: number,
  token: string
): Promise<StravaActivity | null> {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Workout classifier ───────────────────────────────────────────────────────
function classifyBySplits(
  splits: StravaSplit[],
  nameHint: string
): { label: string; confidence: number } {
  const name = nameHint.toLowerCase();
  if (name.includes("interval")) return { label: "Intervalado", confidence: 0.99 };
  if (name.includes("fartlek"))  return { label: "Fartlek", confidence: 0.99 };
  if (name.includes("regener") || name.includes("desaquec"))
    return { label: "Regenerativo", confidence: 0.99 };
  if (name.includes("rodagem"))  return { label: "Rodagem", confidence: 0.95 };
  if (name.includes("progressiv")) return { label: "Progressivo", confidence: 0.95 };

  if (!splits || splits.length < 3) return { label: "Corrida base", confidence: 0.5 };

  const speeds = splits
    .map((s) => (s.distance > 0 && s.moving_time > 0 ? (s.distance / s.moving_time) * 3.6 : 0))
    .filter((s) => s > 0);

  if (speeds.length < 2) return { label: "Corrida base", confidence: 0.5 };

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const std = Math.sqrt(speeds.map((s) => (s - avg) ** 2).reduce((a, b) => a + b, 0) / speeds.length);
  const max = Math.max(...speeds);
  const fastCount = speeds.filter((s) => s > 13.0).length;
  const pctFast = fastCount / speeds.length;
  const first = speeds.slice(0, Math.floor(speeds.length / 3));
  const last = speeds.slice(Math.floor((2 * speeds.length) / 3));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast = last.reduce((a, b) => a + b, 0) / last.length;
  const isProgressive = avgLast - avgFirst > 0.8;

  // Splits por km têm variação interna suavizada — thresholds menores que análise .fit
  if (fastCount >= 3 && pctFast > 0.2 && std > 0.8)
    return { label: "Intervalado", confidence: Math.min(0.90, 0.65 + fastCount * 0.04) };
  if (fastCount >= 2 && pctFast > 0.15 && std > 0.6)
    return { label: "Fartlek", confidence: 0.75 };
  if (fastCount >= 1 && max > 14.5)
    return { label: "Tiro", confidence: 0.78 };
  if (isProgressive && std < 1.2)
    return { label: "Progressivo", confidence: 0.72 };
  if (avg > 11.5 && std < 0.6 && pctFast > 0.2)
    return { label: "Tempo Run", confidence: 0.70 };
  if (avg < 10.5 && std < 0.5)
    return { label: "Regenerativo", confidence: 0.65 };

  return { label: "Corrida base", confidence: 0.60 };
}

const QUALITY_TYPES = new Set([
  "Intervalado", "Fartlek", "Tiro", "Progressivo", "Tempo Run", "Rodagem",
]);

function formatBRDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso.slice(0, 10); }
}

export default async function TreinosQualidadePage() {
  const token = await getValidStravaAccessToken();
  const activities = await getActivities();

  const runs = activities.filter((a) => a.type === "Run");

  // Filter candidates: 5–16km, not races/longões/recovery
  const EXCLUDE_PATTERN = /prova|maratona|long[aã]o|regenerat|desaquec/i;
  const candidates = runs.filter((a) => {
    const km = a.distance / 1000;
    return km >= 5 && km <= 16 && !EXCLUDE_PATTERN.test(a.name);
  });

  // Fetch detailed data (splits) for each candidate
  const workouts: QualityWorkout[] = [];

  if (token) {
    // Fetch in parallel batches of 5 to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const details = await Promise.all(
        batch.map((a) => getDetailedActivity(a.id, token))
      );

      batch.forEach((activity, idx) => {
        const detail = details[idx];
        const splits = detail?.splits_metric ?? [];
        const { label, confidence } = classifyBySplits(splits, activity.name);

        const kmSplits = splits.map((s) => {
          const paceMinPerKm =
            s.distance > 0 && s.moving_time > 0
              ? s.moving_time / s.distance
              : null;
          return {
            km: s.split,
            pace: paceMinPerKm ? parseFloat(paceMinPerKm.toFixed(4)) : null,
            fc: s.average_heartrate ? Math.round(s.average_heartrate) : null,
          };
        });

        workouts.push({
          id: String(activity.id),
          date: activity.start_date_local.slice(0, 10),
          name: activity.name,
          distKm: parseFloat((activity.distance / 1000).toFixed(2)),
          label,
          confidence,
          fcAvg: activity.average_heartrate
            ? Math.round(activity.average_heartrate)
            : null,
          fcMax: activity.max_heartrate
            ? Math.round(activity.max_heartrate)
            : null,
          elev: Math.round(activity.total_elevation_gain),
          cal: detail?.calories ?? 0,
          kmSplits,
        });
      });
    }
  }

  const qualityWorkouts = workouts.filter((w) => QUALITY_TYPES.has(w.label));
  const baseWorkouts = workouts.filter((w) => !QUALITY_TYPES.has(w.label));

  const totalQuality = qualityWorkouts.length;
  const avgFcMax = qualityWorkouts.filter((w) => w.fcMax).length > 0
    ? Math.round(qualityWorkouts.filter((w) => w.fcMax).reduce((s, w) => s + (w.fcMax ?? 0), 0) / qualityWorkouts.filter((w) => w.fcMax).length)
    : null;
  const countByType = qualityWorkouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.label] = (acc[w.label] || 0) + 1;
    return acc;
  }, {});
  const mostCommon = Object.entries(countByType).sort((a, b) => b[1] - a[1])[0];

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-600">Treinos</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Treinos de qualidade
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Classificação automática por padrão de velocidade — intervalados, fartleks, progressivos e mais.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RevalidateButton path="/treinos-qualidade" />
            <Link
              href="/"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              ← Voltar ao dashboard
            </Link>
          </div>
        </div>

        {/* Summary */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Treinos de qualidade</p>
            <p className="mt-2 text-2xl font-bold text-orange-600">{totalQuality}</p>
            <p className="mt-1 text-xs text-gray-400">desde jan/2026</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Tipo mais frequente</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {mostCommon?.[0] ?? "-"}
            </p>
            <p className="mt-1 text-xs text-gray-400">{mostCommon?.[1] ?? 0}x realizados</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">FC máxima média</p>
            <p className="mt-2 text-2xl font-bold text-red-500">
              {avgFcMax ? `${avgFcMax} bpm` : "-"}
            </p>
            <p className="mt-1 text-xs text-gray-400">nos treinos de qualidade</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Corridas base</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{baseWorkouts.length}</p>
            <p className="mt-1 text-xs text-gray-400">sem padrão de qualidade detectado</p>
          </div>
        </section>

        {/* Charts + list */}
        {qualityWorkouts.length > 0 ? (
          <QualityWorkoutsChart workouts={qualityWorkouts} />
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Nenhum treino de qualidade encontrado. Verifique a conexão com o Strava.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

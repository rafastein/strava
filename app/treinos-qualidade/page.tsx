export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import { fetchStravaApi, getStravaActivities } from "../lib/strava-client";
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
  laps?: StravaLap[];
};

type StravaLap = {
  id: number;
  name: string;
  lap_index: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  pace_zone?: number;
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
  return getStravaActivities({ after: AFTER_EPOCH, maxPages: 15 });
}

async function getDetailedActivity(
  id: number,
  token: string
): Promise<StravaActivity | null> {
  return fetchStravaApi<StravaActivity>(`/activities/${id}`, { accessToken: token });
}

async function getActivityLaps(
  id: number,
  token: string
): Promise<StravaLap[]> {
  const laps = await fetchStravaApi<StravaLap[]>(`/activities/${id}/laps`, { accessToken: token });
  return Array.isArray(laps) ? laps : [];
}

// ── Workout classifier ───────────────────────────────────────────────────────
function classifyBySplits(
  splits: StravaSplit[],
  nameHint: string
): { label: string; confidence: number } {
  const name = nameHint.toLowerCase();
  if (name.includes("interval") || name.includes("tiro")) return { label: "Intervalado", confidence: 0.99 };
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
    return { label: "Intervalado", confidence: 0.78 };
  if (isProgressive && std < 1.2)
    return { label: "Progressivo", confidence: 0.72 };
  if (avg > 11.5 && std < 0.6 && pctFast > 0.2)
    return { label: "Tempo Run", confidence: 0.70 };
  if (avg < 10.5 && std < 0.5)
    return { label: "Regenerativo", confidence: 0.65 };

  return { label: "Corrida base", confidence: 0.60 };
}

function classifyByLaps(
  laps: StravaLap[],
  nameHint: string
): { label: string; confidence: number } | null {
  if (!laps || laps.length < 2) return null;

  const name = nameHint.toLowerCase();
  if (name.includes("interval") || name.includes("tiro")) return { label: "Intervalado", confidence: 0.99 };
  if (name.includes("fartlek"))  return { label: "Fartlek", confidence: 0.99 };

  // Detect fast laps (< 5:00/km = > 12 km/h)
  const speeds = laps.map((l) =>
    l.distance > 0 && l.moving_time > 0 ? (l.distance / l.moving_time) * 3.6 : 0
  ).filter((s) => s > 0);

  if (speeds.length < 2) return null;

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const max = Math.max(...speeds);
  const min = Math.min(...speeds);
  const range = max - min;
  const fastLaps = speeds.filter((s) => s > 12.0);
  const slowLaps = speeds.filter((s) => s < 10.5);

  // Clear intervals: alternating fast/slow laps with large range
  if (fastLaps.length >= 2 && slowLaps.length >= 1 && range > 2.5)
    return { label: "Intervalado", confidence: Math.min(0.97, 0.75 + fastLaps.length * 0.04) };

  // Fartlek: variation but not as structured
  if (range > 1.8 && fastLaps.length >= 1)
    return { label: "Fartlek", confidence: 0.80 };

  // Progressive: last third faster than first third
  const thirds = Math.floor(speeds.length / 3);
  const firstAvg = speeds.slice(0, thirds).reduce((a, b) => a + b, 0) / thirds;
  const lastAvg = speeds.slice(-thirds).reduce((a, b) => a + b, 0) / thirds;
  if (lastAvg - firstAvg > 0.8 && range < 2.0)
    return { label: "Progressivo", confidence: 0.80 };

  return null;
}

const QUALITY_TYPES = new Set([
  "Intervalado", "Fartlek", "Progressivo", "Tempo Run", "Rodagem",
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
      const [details, lapsAll] = await Promise.all([
        Promise.all(batch.map((a) => getDetailedActivity(a.id, token))),
        Promise.all(batch.map((a) => getActivityLaps(a.id, token))),
      ]);

      batch.forEach((activity, idx) => {
        const detail = details[idx];
        const splits = detail?.splits_metric ?? [];
        const laps = lapsAll[idx] ?? [];

        // Classify: laps first (more accurate), fallback to splits
        const lapClass = classifyByLaps(laps, activity.name);
        const { label, confidence } = lapClass ?? classifyBySplits(splits, activity.name);

        const kmSplits = splits.map((s) => {
          const paceMinPerKm =
            s.distance > 0 && s.moving_time > 0
              ? (s.moving_time / s.distance) * (1000 / 60)
              : null;
          return {
            km: s.split,
            pace: paceMinPerKm ? parseFloat(paceMinPerKm.toFixed(4)) : null,
            fc: s.average_heartrate ? Math.round(s.average_heartrate) : null,
          };
        });

        // Build lap data for visualization
        const lapData = laps
          .filter((l) => l.distance > 50) // ignore very short laps
          .map((l) => ({
            index: l.lap_index,
            name: l.name,
            distKm: parseFloat((l.distance / 1000).toFixed(3)),
            timeSec: l.moving_time,
            paceMinPerKm: l.distance > 0 && l.moving_time > 0
              ? parseFloat(((l.moving_time / l.distance) * (1000 / 60)).toFixed(3))
              : null,
            fcAvg: l.average_heartrate ? Math.round(l.average_heartrate) : null,
            fcMax: l.max_heartrate ? Math.round(l.max_heartrate) : null,
            speedKmh: parseFloat(((l.distance / l.moving_time) * 3.6).toFixed(2)),
          }));

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
          laps: lapData,
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
    <div className="page">
      <Navbar />
      <main className="ba-page">

        {/* Header */}
        <div className="ba-page-header" style={{ marginBottom: "2rem" }}>
          <div>
            <p className="ba-eyebrow">Treinos</p>
            <h1 className="ba-title">Treinos de qualidade</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              Classificação automática por padrão de velocidade — intervalados, fartleks, progressivos e mais.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <RevalidateButton path="/treinos-qualidade" />
            <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
          </div>
        </div>

        {/* Summary cards */}
        <section className="ba-grid-4" style={{ marginBottom: "1rem" }}>
          <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
            <p className="ba-label">Treinos de qualidade</p>
            <p className="ba-value" style={{ fontSize: "2rem", color: "#f5a623", marginTop: ".4rem" }}>{totalQuality}</p>
            <p className="ba-muted" style={{ marginTop: ".3rem" }}>desde jan/2026</p>
          </div>
          <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
            <p className="ba-label">Tipo mais frequente</p>
            <p className="ba-value" style={{ fontSize: "1.6rem", marginTop: ".4rem" }}>{mostCommon?.[0] ?? "—"}</p>
            <p className="ba-muted" style={{ marginTop: ".3rem" }}>{mostCommon?.[1] ?? 0}x realizados</p>
          </div>
          <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
            <p className="ba-label">FC máxima média</p>
            <p className="ba-value" style={{ fontSize: "2rem", color: "#ef4444", marginTop: ".4rem" }}>{avgFcMax ? `${avgFcMax} bpm` : "—"}</p>
            <p className="ba-muted" style={{ marginTop: ".3rem" }}>nos treinos de qualidade</p>
          </div>
          <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
            <p className="ba-label">Corridas base</p>
            <p className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem" }}>{baseWorkouts.length}</p>
            <p className="ba-muted" style={{ marginTop: ".3rem" }}>sem padrão detectado</p>
          </div>
        </section>

        {/* Charts + list */}
        {qualityWorkouts.length > 0 ? (
          <QualityWorkoutsChart workouts={qualityWorkouts} />
        ) : (
          <div className="ba-card" style={{ padding: "2rem", textAlign: "center" }}>
            <p className="ba-muted">Nenhum treino de qualidade encontrado. Verifique a conexão com o Strava.</p>
          </div>
        )}

      </main>
      <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}
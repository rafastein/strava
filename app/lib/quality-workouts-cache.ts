import { getCurrentSeasonYear } from "./season";
import type { QualityWorkout } from "../components/QualityWorkoutsChart";
import { getRedisClient } from "./redis-client";

// Uma chave por temporada: em 2026 o nome é o mesmo de antes, então o cache atual continua valendo.
function getSnapshotKey() {
  return `quality-workouts:snapshot:v3:${getCurrentSeasonYear()}`;
}
const QUALITY_WORKOUTS_SNAPSHOT_TTL_SECONDS = 12 * 3600;

export type QualityWorkoutsSnapshot = {
  version: 3;
  cachedAt: number;
  sourceLabel: string;
  workouts: QualityWorkout[];
};

function parseRedisValue<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}

export async function getQualityWorkoutsSnapshot(): Promise<QualityWorkoutsSnapshot | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const raw = await redis.get(getSnapshotKey());
  const snapshot = parseRedisValue<QualityWorkoutsSnapshot>(raw);
  if (!snapshot?.workouts || !Array.isArray(snapshot.workouts)) return null;
  return snapshot;
}

export async function setQualityWorkoutsSnapshot(workouts: QualityWorkout[], sourceLabel: string) {
  const redis = await getRedisClient();
  if (!redis) return;

  const snapshot: QualityWorkoutsSnapshot = {
    version: 3,
    cachedAt: Date.now(),
    sourceLabel,
    workouts,
  };

  await redis.set(getSnapshotKey(), snapshot, {
    ex: QUALITY_WORKOUTS_SNAPSHOT_TTL_SECONDS,
  });
}

export async function clearQualityWorkoutsSnapshot() {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.del(getSnapshotKey());
}

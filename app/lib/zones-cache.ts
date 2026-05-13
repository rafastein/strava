// lib/zones-cache.ts
// Cache progressivo de zonas de ritmo no Redis (Upstash)

export type ZoneEntry = {
  zone: number;
  label: string;
  timeSec: number;
  pct: number;
  minPaceSec: number | null;
  maxPaceSec: number | null;
};

export type CachedActivityZones = {
  activityId: number;
  date: string; // ISO date YYYY-MM-DD
  zones: ZoneEntry[];
  totalTimeSec: number;
  cachedAt: number; // timestamp
};

export type ZoneAggregate = {
  zone: number;
  label: string;
  timeSec: number;
  pct: number;
  minPaceSec: number | null;
  maxPaceSec: number | null;
};

function getRedis() {
  const url   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN  ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisGet<T>(key: string): Promise<T | null> {
  const cfg = getRedis();
  if (!cfg) return null;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis(cfg);
  return redis.get<T>(key);
}

async function redisSet(key: string, value: unknown, exSeconds?: number) {
  const cfg = getRedis();
  if (!cfg) return;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis(cfg);
  if (exSeconds) await redis.set(key, JSON.stringify(value), { ex: exSeconds });
  else await redis.set(key, JSON.stringify(value));
}

async function redisMGet(keys: string[]): Promise<(unknown | null)[]> {
  if (!keys.length) return [];
  const cfg = getRedis();
  if (!cfg) return keys.map(() => null);
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis(cfg);
  return redis.mget(...keys);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCachedZones(activityId: number): Promise<CachedActivityZones | null> {
  const raw = await redisGet<string | CachedActivityZones>(`zones:${activityId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function setCachedZones(data: CachedActivityZones) {
  // Cache por 90 dias
  await redisSet(`zones:${data.activityId}`, data, 90 * 24 * 3600);
}

export async function getMultiCachedZones(activityIds: number[]): Promise<Map<number, CachedActivityZones>> {
  const keys = activityIds.map((id) => `zones:${id}`);
  const raws = await redisMGet(keys);
  const map = new Map<number, CachedActivityZones>();
  raws.forEach((raw, i) => {
    if (!raw) return;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      map.set(activityIds[i], parsed as CachedActivityZones);
    } catch {}
  });
  return map;
}

export async function fetchAndCacheZones(
  activityId: number,
  date: string,
  token: string
): Promise<CachedActivityZones | null> {
  try {
    const [streamsRes, zonesRes] = await Promise.all([
      fetch(
        `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=velocity_smooth,time&key_by_type=true&resolution=medium`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      ),
      fetch(
        "https://www.strava.com/api/v3/athlete/zones",
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      ),
    ]);

    if (!streamsRes.ok || !zonesRes.ok) return null;

    const streams = await streamsRes.json();
    const zonesData = await zonesRes.json();

    const velocities: number[] = streams.velocity_smooth?.data ?? [];
    const times: number[]      = streams.time?.data ?? [];
    let paceZones: { min: number; max: number }[] = zonesData.pace?.zones ?? [];

    // Fallback: zonas padrão se Strava não tiver zonas configuradas
    // Baseado em pace típico para VDOT ~45 (min/max em m/s, Z1=mais lento)
    if (!paceZones.length) {
      // Pace ranges: Z1 >5:44, Z2 4:32-5:44, Z3 4:03-4:32, Z4 3:49-4:03, Z5 3:25-3:49, Z6 <3:25
      // Convertido para m/s: pace(sec/km) → speed = 1000/pace_sec
      paceZones = [
        { min: -1,                  max: 1000 / 344 }, // Z1: > 5:44/km
        { min: 1000 / 344,          max: 1000 / 272 }, // Z2: 4:32–5:44/km
        { min: 1000 / 272,          max: 1000 / 243 }, // Z3: 4:03–4:32/km
        { min: 1000 / 243,          max: 1000 / 229 }, // Z4: 3:49–4:03/km
        { min: 1000 / 229,          max: 1000 / 205 }, // Z5: 3:25–3:49/km
        { min: 1000 / 205,          max: -1          }, // Z6: < 3:25/km
      ];
    }

    if (!velocities.length || !paceZones.length) return null;

    const zoneTimes = new Array(paceZones.length).fill(0);
    for (let i = 1; i < velocities.length; i++) {
      const v  = velocities[i];
      const dt = times[i] - times[i - 1];
      if (v <= 0 || dt <= 0) continue;
      for (let z = 0; z < paceZones.length; z++) {
        const zone  = paceZones[z];
        const minOk = zone.min === -1 || v >= zone.min;
        const maxOk = zone.max === -1 || v < zone.max;
        if (minOk && maxOk) { zoneTimes[z] += dt; break; }
      }
    }

    const totalTimeSec = zoneTimes.reduce((a, b) => a + b, 0);
    const zones: ZoneEntry[] = paceZones.map((zone, i) => ({
      zone:       i + 1,
      label:      `Z${i + 1}`,
      timeSec:    Math.round(zoneTimes[i]),
      pct:        totalTimeSec > 0 ? Math.round((zoneTimes[i] / totalTimeSec) * 100) : 0,
      minPaceSec: zone.min > 0 ? Math.round(1000 / zone.min) : null,
      maxPaceSec: zone.max > 0 ? Math.round(1000 / zone.max) : null,
    })).reverse(); // Z6 first

    const cached: CachedActivityZones = {
      activityId,
      date,
      zones,
      totalTimeSec,
      cachedAt: Date.now(),
    };

    await redisSet(`zones:${activityId}`, cached, 90 * 24 * 3600);
    return cached;
  } catch {
    return null;
  }
}

// Aggregate zones for a set of cached activities
export function aggregateZones(activities: CachedActivityZones[]): ZoneAggregate[] {
  if (!activities.length) return [];

  // Collect all zone definitions from first activity
  const template = activities[0].zones;
  const totals   = new Map<number, number>();
  template.forEach((z) => totals.set(z.zone, 0));

  let totalTimeSec = 0;
  for (const act of activities) {
    for (const z of act.zones) {
      totals.set(z.zone, (totals.get(z.zone) ?? 0) + z.timeSec);
      totalTimeSec += z.timeSec / act.zones.length; // rough — each zone counted once per activity
    }
  }

  // Recalculate totalTimeSec properly
  totalTimeSec = 0;
  for (const [, t] of totals) totalTimeSec += t;

  return template.map((z) => ({
    zone:       z.zone,
    label:      z.label,
    timeSec:    totals.get(z.zone) ?? 0,
    pct:        totalTimeSec > 0 ? Math.round(((totals.get(z.zone) ?? 0) / totalTimeSec) * 100) : 0,
    minPaceSec: z.minPaceSec,
    maxPaceSec: z.maxPaceSec,
  }));
}

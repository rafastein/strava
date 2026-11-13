import { NextResponse } from "next/server";
import { getRedisClient } from "./redis-client";

// Limite por IP para as rotas públicas que consomem a cota da API do Strava.
// Janela fixa: no máximo `limit` chamadas por `windowSeconds`.

export type RateLimitRule = { name: string; limit: number; windowSeconds: number };

type Counter = { windowId: number; count: number };

const memoryCounters = new Map<string, Counter>();
const MEMORY_MAX_KEYS = 5000;

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "local";
}

/** Contador em memória: usado sem Redis (dev) ou se o Redis falhar. Vale por instância. */
export function hitMemoryWindow(
  store: Map<string, Counter>,
  key: string,
  windowSeconds: number,
  nowMs: number = Date.now(),
): number {
  const windowId = Math.floor(nowMs / (windowSeconds * 1000));
  const current = store.get(key);
  if (!current || current.windowId !== windowId) {
    if (store.size >= MEMORY_MAX_KEYS) store.clear();
    store.set(key, { windowId, count: 1 });
    return 1;
  }
  current.count += 1;
  return current.count;
}

async function countHit(key: string, windowSeconds: number): Promise<number> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
      const redisKey = `ratelimit:${key}:${windowId}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, windowSeconds);
      return count;
    }
  } catch (error) {
    console.warn("Rate limit: Redis indisponível, usando memória.", error);
  }
  return hitMemoryWindow(memoryCounters, key, windowSeconds);
}

/** Devolve uma resposta 429 quando o IP passou do limite; `null` quando pode seguir. */
export async function enforceRateLimit(req: Request, rule: RateLimitRule): Promise<NextResponse | null> {
  const count = await countHit(`${rule.name}:${getClientIp(req)}`, rule.windowSeconds);
  if (count <= rule.limit) return null;

  return NextResponse.json(
    { error: "Muitas requisições. Tente de novo em instantes." },
    { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } },
  );
}

/** Id de atividade do Strava: inteiro positivo de até 15 dígitos. */
export function parseActivityId(value: string | null): number | null {
  if (!value || !/^[1-9]\d{0,14}$/.test(value)) return null;
  return Number(value);
}

// Por atividade (splits, zonas): uma página abre várias de uma vez.
export const STRAVA_DETAIL_LIMIT: RateLimitRule = { name: "strava-detail", limit: 60, windowSeconds: 60 };
// Agregados (carga, zonas do período): poucas chamadas por visita.
export const STRAVA_AGGREGATE_LIMIT: RateLimitRule = { name: "strava-aggregate", limit: 20, windowSeconds: 60 };

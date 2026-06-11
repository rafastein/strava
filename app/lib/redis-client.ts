import type { Redis } from "@upstash/redis";

export async function getRedisClient(): Promise<Redis | null> {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

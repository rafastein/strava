import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../../lib/strava-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const envRefreshToken = process.env.STRAVA_REFRESH_TOKEN;
  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  let redisStatus = "sem config";
  let redisTokenInfo = null;

  if (kvUrl && kvToken) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: kvUrl, token: kvToken });
      const raw = await redis.get("strava:token");
      redisStatus = raw ? "token encontrado" : "token ausente";
      if (raw) {
        const p = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
        redisTokenInfo = {
          has_access_token:  !!p.access_token,
          has_refresh_token: !!p.refresh_token,
          expires_at: p.expires_at,
          expired: typeof p.expires_at === "number" ? p.expires_at < Math.floor(Date.now() / 1000) : "unknown",
        };
      }
    } catch (e) { redisStatus = `erro: ${String(e)}`; }
  }

  let accessToken = null;
  let tokenError  = null;
  try { accessToken = await getValidStravaAccessToken(); }
  catch (e) { tokenError = String(e); }

  return NextResponse.json({
    env: {
      has_client_id:       !!process.env.STRAVA_CLIENT_ID,
      has_client_secret:   !!process.env.STRAVA_CLIENT_SECRET,
      has_refresh_token:   !!envRefreshToken,
      refresh_token_start: envRefreshToken ? envRefreshToken.slice(0, 8) + "..." : null,
      has_kv_url:          !!kvUrl,
      has_kv_token:        !!kvToken,
    },
    redis:  { status: redisStatus, token: redisTokenInfo },
    result: { got_access_token: !!accessToken, error: tokenError },
  });
}

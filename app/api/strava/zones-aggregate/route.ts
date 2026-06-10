import { NextRequest, NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import {
  getStravaActivities,
  getStravaActivityStreams,
  getStravaAthleteZones,
  isRunActivity,
  type StravaActivitySummary,
} from "../../../lib/strava-client";
import {
  getMultiCachedZones,
  fetchAndCacheZones,
  aggregateZones,
  type CachedActivityZones,
} from "../../../lib/zones-cache";

type StravaActivity = StravaActivitySummary;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "week"; // week | month | cycle

  const token = await getValidStravaAccessToken();
  if (!token) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    // Fetch recent activities from Strava
    const now = new Date();
    let afterDate: Date;
    if (period === "week") {
      afterDate = getWeekStart(now);
    } else if (period === "month") {
      afterDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // cycle = last 16 weeks
      afterDate = new Date(now.getTime() - 16 * 7 * 24 * 3600 * 1000);
    }

    const after = Math.floor(afterDate.getTime() / 1000);
    const activities: StravaActivity[] = await getStravaActivities({
      accessToken: token,
      after,
      perPage: 80,
      maxPages: 1,
    });
    const runs = activities.filter(isRunActivity);

    if (!runs.length) return NextResponse.json({ zones: [], runCount: 0, period });

    // Check cache for all runs
    const ids = runs.map((r) => r.id);
    const cached = await getMultiCachedZones(ids);

    // Fetch missing ones (max 5 to avoid rate limit)
    const missing = runs.filter((r) => !cached.has(r.id)).slice(0, 5);
    const newlyFetched: CachedActivityZones[] = [];
    const fetchErrors: { id: number; error: string }[] = [];

    await Promise.all(
      missing.map(async (run) => {
        const date = run.start_date_local.slice(0, 10);
        try {
          const result = await fetchAndCacheZones(run.id, date, token);
          if (result) {
            newlyFetched.push(result);
          } else {
            // Debug: check what the streams and zones endpoints return
            const [sData, zData] = await Promise.all([
              getStravaActivityStreams(run.id, ["velocity_smooth", "time"], token),
              getStravaAthleteZones(token),
            ]);
            fetchErrors.push({
              id: run.id,
              error: `streams_ok=${Boolean(sData)} velocities=${sData?.velocity_smooth?.data?.length ?? 0} zones_ok=${Boolean(zData)} pace_zones=${zData?.pace?.zones?.length ?? 0} zone_keys=${Object.keys(zData ?? {}).join(",")}`,
            });
          }
        } catch (e) {
          fetchErrors.push({ id: run.id, error: String(e) });
        }
      })
    );

    // Combine cached + newly fetched
    const allCached: CachedActivityZones[] = [
      ...Array.from(cached.values()),
      ...newlyFetched,
    ];

    const zones = aggregateZones(allCached);
    const cachedCount = allCached.length;
    const missingCount = runs.length - cachedCount;

    return NextResponse.json({
      zones,
      runCount: runs.length,
      cachedCount,
      missingCount,
      period,
      debug: fetchErrors.length > 0 ? fetchErrors : undefined,
    });
  } catch (err) {
    console.error("zones-aggregate error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

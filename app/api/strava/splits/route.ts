import { NextRequest, NextResponse } from "next/server";
import { STRAVA_DETAIL_LIMIT, enforceRateLimit, parseActivityId } from "../../../lib/rate-limit";
import { getActivitySplits } from "../../../lib/strava-splits";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, STRAVA_DETAIL_LIMIT);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = parseActivityId(searchParams.get("id"));

  if (id === null) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const splits = await getActivitySplits(id);

  if (!splits) {
    return NextResponse.json({ error: "Não foi possível buscar os splits" }, { status: 502 });
  }

  return NextResponse.json(splits);
}

// app/api/debug-vdot/route.ts
// ROTA TEMPORÁRIA DE DEBUG — remover após resolver o problema
import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../lib/strava-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessToken = await getValidStravaAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Sem access token" }, { status: 401 });
  }

  // 1. Quem é o atleta desse token?
  const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const athlete = await athleteRes.json();

  // 2. 5 atividades mais recentes SEM filtro after
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("per_page", "5");
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await res.json();

  const summary = data.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    sport_type: a.sport_type,
    distance: a.distance,
    moving_time: a.moving_time,
    start_date_local: a.start_date_local,
  }));

  return NextResponse.json({
    token_preview: accessToken.slice(-6),
    athlete_id: athlete.id,
    athlete_name: `${athlete.firstname} ${athlete.lastname}`,
    token_expires_at: athlete.errors ?? "token ok",
    most_recent_5: summary,
  });
}
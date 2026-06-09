// app/api/debug-vdot/route.ts
// ROTA TEMPORÁRIA DE DEBUG — remover após resolver o problema
import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../lib/strava-auth";

export const dynamic = "force-dynamic";

const WINDOW_PARTIAL_MONTHS = 18;

export async function GET() {
  const accessToken = await getValidStravaAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Sem access token" }, { status: 401 });
  }

  const after =
    Math.floor(Date.now() / 1000) -
    Math.ceil(WINDOW_PARTIAL_MONTHS * 30.44) * 24 * 3600;

  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("per_page", "5");
  url.searchParams.set("page", "1");
  url.searchParams.set("after", String(after));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Strava API error", status: res.status });
  }

  const data = await res.json();

  // Mostra os campos relevantes das 5 atividades mais recentes
  const summary = data.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,           // campo antigo
    sport_type: a.sport_type, // campo novo
    distance: a.distance,
    moving_time: a.moving_time,
    start_date_local: a.start_date_local,
    isRunByType: a.type === "Run",
    isRunBySportType: a.sport_type === "Run",
    wouldBeIncluded: a.type === "Run" || a.sport_type === "Run",
  }));

  return NextResponse.json({ token_preview: accessToken.slice(-6), activities: summary });
}
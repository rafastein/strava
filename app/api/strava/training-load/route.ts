import { NextResponse } from "next/server";
import { STRAVA_AGGREGATE_LIMIT, enforceRateLimit } from "../../../lib/rate-limit";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import { getTrainingLoadSnapshot } from "../../../lib/training-load-snapshot";

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, STRAVA_AGGREGATE_LIMIT);
  if (limited) return limited;

  const token = await getValidStravaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getTrainingLoadSnapshot(token));
  } catch (err) {
    console.error("Erro ao calcular training load:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

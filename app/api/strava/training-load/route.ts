import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import { getTrainingLoadSnapshot } from "../../../lib/training-load-snapshot";

export async function GET() {
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

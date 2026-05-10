import { NextRequest, NextResponse } from "next/server";
import { getActivitySplits } from "../../../lib/strava-splits";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const splits = await getActivitySplits(Number(id));

  if (!splits) {
    return NextResponse.json({ error: "Não foi possível buscar os splits" }, { status: 502 });
  }

  return NextResponse.json(splits);
}

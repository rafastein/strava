import { NextRequest, NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import { getStravaActivityStreams, getStravaAthleteZones } from "../../../lib/strava-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const token = await getValidStravaAccessToken();
  if (!token) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  try {
    const [streams, zonesData] = await Promise.all([
      getStravaActivityStreams(Number(id), ["velocity_smooth", "time"], token),
      getStravaAthleteZones(token),
    ]);

    if (!streams) return NextResponse.json({ error: "Erro ao buscar stream" }, { status: 502 });

    const velocities: number[] = streams.velocity_smooth?.data ?? [];
    const times: number[]      = streams.time?.data ?? [];
    let paceZones: { min: number; max: number }[] = zonesData?.pace?.zones ?? [];

    if (!paceZones.length) {
      paceZones = [
        { min: -1,         max: 1000/344 },
        { min: 1000/344,   max: 1000/272 },
        { min: 1000/272,   max: 1000/243 },
        { min: 1000/243,   max: 1000/229 },
        { min: 1000/229,   max: 1000/205 },
        { min: 1000/205,   max: -1       },
      ];
    }

    if (!velocities.length) return NextResponse.json({ error: "Stream vazio" }, { status: 404 });

    const zoneTimes = new Array(paceZones.length).fill(0);
    for (let i = 1; i < velocities.length; i++) {
      const v  = velocities[i];
      const dt = times[i] - times[i - 1];
      if (v <= 0 || dt <= 0) continue;
      for (let z = 0; z < paceZones.length; z++) {
        const zone  = paceZones[z];
        const minOk = zone.min === -1 || v >= zone.min;
        const maxOk = zone.max === -1 || v < zone.max;
        if (minOk && maxOk) { zoneTimes[z] += dt; break; }
      }
    }

    const totalTime = zoneTimes.reduce((a, b) => a + b, 0);
    const result = paceZones.map((zone, i) => ({
      zone:       i + 1,
      label:      `Z${i + 1}`,
      timeSec:    Math.round(zoneTimes[i]),
      pct:        totalTime > 0 ? Math.round((zoneTimes[i] / totalTime) * 100) : 0,
      minPaceSec: zone.min > 0 ? Math.round(1000 / zone.min) : null,
      maxPaceSec: zone.max > 0 ? Math.round(1000 / zone.max) : null,
    })).reverse();

    return NextResponse.json({ zones: result });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

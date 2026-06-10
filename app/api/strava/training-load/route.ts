import { NextResponse } from "next/server";
import athleteConfig from "../../../data/athlete-config.json";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import { calcTrainingLoad, type StravaActivityForLoad } from "../../../lib/training-load";
import { getDynamicAthleteProfile } from "../../../lib/strava-prs";

const DISPLAY_DAYS = 90;
const WARMUP_DAYS = 30;
const FETCH_DAYS = DISPLAY_DAYS + WARMUP_DAYS;
const TIME_ZONE = "America/Sao_Paulo";

// Busca atividades dos últimos N dias
async function fetchActivities(
  accessToken: string,
  daysBack: number
): Promise<StravaActivityForLoad[]> {
  const after = Math.floor(Date.now() / 1000) - daysBack * 24 * 3600;
  const all: StravaActivityForLoad[] = [];

  for (let page = 1; page <= 10; page++) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", "200");
    url.searchParams.set("page", String(page));
    url.searchParams.set("after", String(after));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) break;

    const batch = (await res.json()) as StravaActivityForLoad[];
    if (!Array.isArray(batch) || batch.length === 0) break;

    all.push(...batch);
    if (batch.length < 200) break;
  }

  return all;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function GET() {
  const token = await getValidStravaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    // Busca atividades dos últimos 120 dias: 90 exibidos + 30 de aquecimento real do CTL/ATL.
    const [activities, profile] = await Promise.all([
      fetchActivities(token, FETCH_DAYS),
      getDynamicAthleteProfile(token),
    ]);

    const hrMax = safeNumber(athleteConfig.hrMax, 185);
    const hrRest = safeNumber(athleteConfig.hrRest, 50);

    // Extrai T-pace do VDOT dinâmico do atleta.
    // A faixa clássica usada no projeto é ~83–88% do VDOT; aqui usamos o meio da faixa
    // para o fallback por pace não ficar agressivo demais.
    // Se não disponível, usa 259s/km (4:19/km) como fallback.
    let thresholdPaceSecPerKm = 259;
    if (profile.vdot) {
      const targetVO2 = 0.855 * profile.vdot;
      const a = 0.000104;
      const b = 0.182258;
      const c = -(4.60 + targetVO2);
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const vMetersPerMin = (-b + Math.sqrt(disc)) / (2 * a);
        if (vMetersPerMin > 0) {
          thresholdPaceSecPerKm = Math.round((1000 / vMetersPerMin) * 60);
        }
      }
    }

    const runActivities = activities.filter((a) =>
      ["Run", "TrailRun", "VirtualRun"].includes(a.type) ||
      Boolean(a.sport_type && ["Run", "TrailRun", "VirtualRun"].includes(a.sport_type))
    );
    const withHeartRate = runActivities.filter(
      (a) =>
        typeof a.average_heartrate === "number" &&
        Number.isFinite(a.average_heartrate) &&
        a.average_heartrate > hrRest + 10
    ).length;

    const days = calcTrainingLoad(activities, {
      thresholdPaceSecPerKm,
      hrMax,
      hrRest,
      displayDays: DISPLAY_DAYS,
      warmupDays: WARMUP_DAYS,
      timeZone: TIME_ZONE,
    });

    return NextResponse.json({
      days,
      thresholdPaceSecPerKm,
      vdot: profile.vdot,
      totalActivities: runActivities.length,
      hrMax,
      hrRest,
      displayedDays: DISPLAY_DAYS,
      warmupDays: WARMUP_DAYS,
      fetchDays: FETCH_DAYS,
      timeZone: TIME_ZONE,
      loadMethod: {
        withHeartRate,
        fallbackPace: runActivities.length - withHeartRate,
      },
    });
  } catch (err) {
    console.error("Erro ao calcular training load:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

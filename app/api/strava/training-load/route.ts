import { NextResponse } from "next/server";
import athleteConfig from "../../../../data/athlete-config.json";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";
import { getStravaActivities, isRunActivity } from "../../../lib/strava-client";
import { calcTrainingLoad, type StravaActivityForLoad } from "../../../lib/training-load";
import { getDynamicAthleteProfile } from "../../../lib/strava-prs";

const DISPLAY_DAYS = 90;
const WARMUP_DAYS = 90;
const FETCH_DAYS = 180;
const TIME_ZONE = "America/Sao_Paulo";

// Busca atividades dos últimos N dias
async function fetchActivities(
  accessToken: string,
  daysBack: number
): Promise<StravaActivityForLoad[]> {
  const after = Math.floor(Date.now() / 1000) - daysBack * 24 * 3600;
  return getStravaActivities({ accessToken, after, maxPages: 10 });
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
    // Busca atividades dos últimos 180 dias: 90 exibidos + 90 de aquecimento real do CTL/ATL.
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

    const runActivities = activities.filter(isRunActivity);
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

import athleteConfig from "../../data/athlete-config.json";
import { getStravaActivities, isRunActivity } from "./strava-client";
import { getDynamicAthleteProfile } from "./strava-prs";
import { calcTrainingLoad, type DayLoad, type StravaActivityForLoad } from "./training-load";

const DISPLAY_DAYS = 90;
const WARMUP_DAYS = 90;
const FETCH_DAYS = 180;
const TIME_ZONE = "America/Sao_Paulo";

export type TrainingLoadSnapshot = {
  days: DayLoad[];
  thresholdPaceSecPerKm: number;
  vdot: number | null;
  totalActivities: number;
  hrMax: number;
  hrRest: number;
  displayedDays: number;
  warmupDays: number;
  fetchDays: number;
  timeZone: string;
  loadMethod: { withHeartRate: number; fallbackPace: number };
};

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * CTL/ATL/TSB dos últimos 90 dias (com 90 de aquecimento).
 * Usado pela rota /api/strava/training-load e pelo resumo de carga da home.
 */
export async function getTrainingLoadSnapshot(accessToken: string): Promise<TrainingLoadSnapshot> {
  const after = Math.floor(Date.now() / 1000) - FETCH_DAYS * 24 * 3600;
  const [activities, profile] = await Promise.all([
    getStravaActivities({ accessToken, after, maxPages: 10 }) as Promise<StravaActivityForLoad[]>,
    getDynamicAthleteProfile(accessToken),
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

  return {
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
  };
}

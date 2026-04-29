export const dynamic = "force-dynamic";

import { formatBRDate, getBRDate, getActivityDate } from "../lib/date-utils";
import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import ManualPredictionForm from "../components/ManualPredictionForm";
import WeeklyComparisonChart from "../components/WeeklyComparisonChart";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import {
  getSisrunData,
  getCurrentWeek,
  getTodaySisrunRow,
  getTodayStravaKm,
  getCurrentWeekStravaKm,
  getCurrentWeekLongestRunKm,
  buildWeeklyComparison,
  getWeekStart,
  formatWeekLabel,
  type SisrunWeek,
} from "../lib/sisrun-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date_local: string;
  average_heartrate?: number;
  max_heartrate?: number;
};

type Athlete = {
  id: number;
  firstname: string;
  lastname: string;
  city: string | null;
  state: string | null;
  profile_medium: string | null;
  profile: string | null;
};

type ManualPredictions = {
  stravaMarathonPrediction: string;
};

type HrZone = {
  name: string;
  min: number;
  max: number;
  color: string;
};

type VdotPaceRange = {
  minSecondsPerKm: number;
  maxSecondsPerKm: number;
};

type AthleteConfig = {
  hrMax: number;
  hrRest: number;
  lactateThreshold: number;
  vdot: number;
  vo2max: number;
  vo2maxSources: string[];
  hrZones: HrZone[];
  vdotPaces: {
    marathon: VdotPaceRange;
    halfMarathon: VdotPaceRange;
    10: VdotPaceRange;
    5: VdotPaceRange;
  };
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];

    const res = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=80",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.warn("Falha Strava activities:", res.status);
      return [];
    }

    return res.json();
  } catch (error) {
    console.warn("Erro ao buscar atividades:", error);
    return [];
  }
}

async function getActivityDetail(
  id: number,
  accessToken: string
): Promise<StravaActivity | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAthlete(): Promise<Athlete | null> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return null;

    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("Falha Strava athlete:", res.status);
      return null;
    }

    return res.json();
  } catch (error) {
    console.warn("Erro ao buscar atleta:", error);
    return null;
  }
}

async function getManualPredictions(): Promise<ManualPredictions> {
  const filePath = path.join(process.cwd(), "data", "manual-predictions.json");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { stravaMarathonPrediction: "03:49:00" };
  }
}

async function getAthleteConfig(): Promise<AthleteConfig | null> {
  const filePath = path.join(process.cwd(), "data", "athlete-config.json");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  return formatBRDate(dateString);
}

function formatFullDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}min ${String(secs).padStart(2, "0")}s`;
}

function formatDurationShort(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatSecondsPerKm(secondsPerKm: number) {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

// ─── Business logic ───────────────────────────────────────────────────────────

function daysUntil(targetDate: Date) {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function marathonTimeFromPace(secondsPerKm: number) {
  return Math.round(secondsPerKm * 42.195);
}

function getCyclePhase(today: Date, raceDate: Date) {
  const days = daysUntil(raceDate);

  if (days > 140)
    return {
      name: "Base",
      description: "Consolidar consistência, volume e resistência geral.",
      color: "bg-sky-100 text-sky-700",
    };
  if (days > 70)
    return {
      name: "Construção",
      description: "Aumentar volume e trazer mais especificidade para a maratona.",
      color: "bg-amber-100 text-amber-700",
    };
  if (days > 21)
    return {
      name: "Pico",
      description: "Bloco mais específico, com longões fortes e sessões-chave.",
      color: "bg-orange-100 text-orange-700",
    };

  return {
    name: "Taper",
    description: "Redução de carga para chegar descansado e afiado.",
    color: "bg-emerald-100 text-emerald-700",
  };
}

function getIdealWeeklyVolume(daysToRace: number) {
  if (daysToRace > 140) return 50;
  if (daysToRace > 105) return 58;
  if (daysToRace > 70) return 65;
  if (daysToRace > 42) return 70;
  if (daysToRace > 21) return 62;
  return 40;
}

function getReadinessStatus(params: {
  currentWeekKm: number;
  idealWeekKm: number;
  longestRunKm: number;
  longRuns28Plus: number;
}) {
  const volumeRatio =
    params.idealWeekKm > 0 ? params.currentWeekKm / params.idealWeekKm : 0;

  if (
    volumeRatio >= 0.9 &&
    params.longestRunKm >= 28 &&
    params.longRuns28Plus >= 2
  ) {
    return {
      label: "Verde",
      title: "Prontidão forte",
      description:
        "Seu ciclo mostra bons sinais de especificidade para sustentar a maratona.",
      card: "bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
    };
  }
  if (
    volumeRatio >= 0.7 &&
    params.longestRunKm >= 24 &&
    params.longRuns28Plus >= 1
  ) {
    return {
      label: "Amarelo",
      title: "Prontidão em construção",
      description:
        "O caminho está bom, mas ainda faltam mais base e longões específicos.",
      card: "bg-amber-50 border-amber-200",
      dot: "bg-amber-500",
      text: "text-amber-700",
    };
  }
  return {
    label: "Vermelho",
    title: "Prontidão baixa",
    description:
      "Ainda falta especificidade de maratona para sustentar o alvo com segurança.",
    card: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    text: "text-red-700",
  };
}

function predictFromHalf(half: StravaActivity | null) {
  if (!half) return null;
  return Math.round(half.moving_time * Math.pow(42.195 / 21.0975, 1.06));
}

function predictFromLongRun(longestRun: StravaActivity | null) {
  if (!longestRun) return null;
  const distanceKm = longestRun.distance / 1000;
  if (distanceKm < 24) return null;
  const paceSecPerKm = longestRun.moving_time / distanceKm;
  const adjustedPace =
    distanceKm >= 30
      ? paceSecPerKm + 12
      : distanceKm >= 28
      ? paceSecPerKm + 16
      : paceSecPerKm + 22;
  return marathonTimeFromPace(adjustedPace);
}

function predictBySiteModel(params: {
  bestHalf: StravaActivity | null;
  longestRun: StravaActivity | null;
  weeklyData: { label: string; distanceKm: number }[];
}) {
  const halfPrediction = predictFromHalf(params.bestHalf);
  const longRunPrediction = predictFromLongRun(params.longestRun);
  const recentWeeklyAverage =
    params.weeklyData.length > 0
      ? params.weeklyData.reduce((sum, item) => sum + item.distanceKm, 0) /
        params.weeklyData.length
      : 0;

  if (halfPrediction && longRunPrediction) {
    let base = Math.round((halfPrediction + longRunPrediction) / 2);
    if (recentWeeklyAverage >= 60) base -= 120;
    else if (recentWeeklyAverage < 40) base += 180;
    return base;
  }
  if (halfPrediction) {
    let base = halfPrediction;
    if (recentWeeklyAverage >= 60) base -= 90;
    else if (recentWeeklyAverage < 40) base += 180;
    return base;
  }
  if (longRunPrediction) return longRunPrediction;
  return null;
}

function predictFromVdot(config: AthleteConfig | null): {
  min: number;
  max: number;
} | null {
  if (!config) return null;
  const { minSecondsPerKm, maxSecondsPerKm } = config.vdotPaces.marathon;
  return {
    min: marathonTimeFromPace(minSecondsPerKm),
    max: marathonTimeFromPace(maxSecondsPerKm),
  };
}

function getHrZoneForBpm(bpm: number, zones: HrZone[]): HrZone | null {
  return zones.find((z) => bpm >= z.min && bpm <= z.max) ?? null;
}

function getHrPctMax(bpm: number, hrMax: number) {
  return Math.round((bpm / hrMax) * 100);
}

function buildBuenosAiresAlerts(params: {
  hasPlan: boolean;
  plannedWeekKm: number;
  currentWeekKm: number;
  adherencePct: number;
  plannedLongRunKm: number;
  currentWeekLongestRunKm: number;
  todayStatus: string;
  config: AthleteConfig | null;
}) {
  const alerts: { title: string; text: string; tone: string }[] = [];

  if (!params.hasPlan) {
    alerts.push({
      title: "Planejamento ausente",
      text: "Carregue uma planilha do SisRUN para comparar a semana atual.",
      tone: "bg-gray-50 text-gray-700",
    });
    return alerts;
  }

  if (params.adherencePct < 70) {
    alerts.push({
      title: "Semana abaixo da meta",
      text: `Você executou ${params.currentWeekKm.toFixed(1)} km de ${params.plannedWeekKm.toFixed(1)} km planejados.`,
      tone: "bg-red-50 text-red-700",
    });
  } else if (params.adherencePct < 90) {
    alerts.push({
      title: "Semana em construção",
      text: `Boa evolução, mas ainda faltam ${Math.max(
        params.plannedWeekKm - params.currentWeekKm,
        0
      ).toFixed(1)} km para a meta da semana.`,
      tone: "bg-amber-50 text-amber-700",
    });
  } else {
    alerts.push({
      title: "Volume da semana bem encaminhado",
      text: "A execução está acompanhando bem o planejado do SisRUN.",
      tone: "bg-emerald-50 text-emerald-700",
    });
  }

  if (
    params.plannedLongRunKm > 0 &&
    params.currentWeekLongestRunKm < params.plannedLongRunKm
  ) {
    alerts.push({
      title: "Longão ainda não cumprido",
      text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`,
      tone: "bg-amber-50 text-amber-700",
    });
  } else if (params.plannedLongRunKm > 0) {
    alerts.push({
      title: "Longão da semana cumprido",
      text: `Previsto: ${params.plannedLongRunKm.toFixed(1)} km • maior treino da semana: ${params.currentWeekLongestRunKm.toFixed(1)} km.`,
      tone: "bg-emerald-50 text-emerald-700",
    });
  }

  if (params.todayStatus === "Pendente") {
    alerts.push({
      title: "Treino de hoje pendente",
      text: "A sessão de hoje ainda não aparece como cumprida no Strava.",
      tone: "bg-amber-50 text-amber-700",
    });
  }

  // Alerta de pace recalibrado pelo VDOT
  if (params.config) {
    const { minSecondsPerKm } = params.config.vdotPaces.marathon;
    const configuredTargetPace = 320; // 5:20/km em segundos — ajuste se tornar dinâmico
    const gap = configuredTargetPace - minSecondsPerKm;
    if (gap > 20) {
      alerts.push({
        title: "Pace-alvo conservador vs. VO2max",
        text: `Seu VDOT ${params.config.vdot} indica potencial para ${formatSecondsPerKm(minSecondsPerKm)}–${formatSecondsPerKm(params.config.vdotPaces.marathon.maxSecondsPerKm)} na maratona. Considere ajustar a meta conforme o ciclo avança.`,
        tone: "bg-blue-50 text-blue-700",
      });
    }
  }

  return alerts;
}

// ─── UI Components ────────────────────────────────────────────────────────────

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
    </div>
  );
}

function ProjectionCard({
  title,
  value,
  caption,
  highlight = false,
  badge,
}: {
  title: string;
  value: string;
  caption: string;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        highlight ? "bg-orange-50 ring-1 ring-orange-200" : "bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-500">{title}</p>
        {badge && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{caption}</p>
    </div>
  );
}

function HrZoneBadge({
  bpm,
  zones,
  hrMax,
}: {
  bpm: number;
  zones: HrZone[];
  hrMax: number;
}) {
  const zone = getHrZoneForBpm(bpm, zones);
  const pct = getHrPctMax(bpm, hrMax);
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: zone?.color ?? "#888" }}
      >
        {zone?.name ?? "—"}
      </span>
      <span className="text-xs text-gray-500">{pct}% FCmáx</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BuenosAiresPage() {
  const accessToken = await getValidStravaAccessToken();

  const [athlete, activities, manualPredictions, sisrunData, config] =
    await Promise.all([
      getAthlete(),
      getActivities(),
      getManualPredictions(),
      getSisrunData(),
      getAthleteConfig(),
    ]);

  const sisrunWeek = getCurrentWeek(sisrunData) as SisrunWeek | null;
  const todaySisrunRow = getTodaySisrunRow(sisrunData);

  const marathonGoal = {
    raceName: "Maratona de Buenos Aires",
    date: new Date("2026-09-20T06:00:00"),
    targetPaceSecondsPerKm: 320,
    targetWeeklyKm: 65,
    targetLongRunKm: 30,
  };

  const today = new Date();
  const daysToRace = daysUntil(marathonGoal.date);
  const cyclePhase = getCyclePhase(today, marathonGoal.date);

  const runs = activities.filter((a) => a.type === "Run");

  const longestRun =
    runs.length > 0
      ? runs.reduce((max, a) => (a.distance > max.distance ? a : max))
      : null;
  const longestRunKm = longestRun ? longestRun.distance / 1000 : 0;

  // Weekly volume map
  const weekMap = new Map<string, { label: string; distanceKm: number }>();
  runs.forEach((activity) => {
    const date = getBRDate(getActivityDate(activity));
    if (!date) return;
    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString();
    const current = weekMap.get(key);
    if (current) {
      current.distanceKm += activity.distance / 1000;
    } else {
      weekMap.set(key, {
        label: formatWeekLabel(weekStart),
        distanceKm: activity.distance / 1000,
      });
    }
  });

  const weeklyData = Array.from(weekMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-10)
    .map(([, value]) => ({
      label: value.label,
      distanceKm: Number(value.distanceKm.toFixed(1)),
    }));

  const currentWeekKm = getCurrentWeekStravaKm(activities);
  const currentWeekLongestRunKm = getCurrentWeekLongestRunKm(activities);
  const todayStravaKm = getTodayStravaKm(activities);

  const plannedWeekKm = sisrunWeek?.totalPlannedKm ?? 0;
  const weeklyAdherencePct =
    plannedWeekKm > 0 ? (currentWeekKm / plannedWeekKm) * 100 : 0;

  const weeklyGoalKm = marathonGoal.targetWeeklyKm;
  const weeklyProgress = Math.min((currentWeekKm / weeklyGoalKm) * 100, 100);

  const targetPaceLabel = formatSecondsPerKm(marathonGoal.targetPaceSecondsPerKm);
  const targetPredictionSeconds = marathonTimeFromPace(marathonGoal.targetPaceSecondsPerKm);

  const longRuns = runs.filter((a) => a.distance >= 28000);
  const longRunsCount = longRuns.length;

  const idealWeekKm = getIdealWeeklyVolume(daysToRace);
  const weekVsIdealDifference = currentWeekKm - idealWeekKm;

  const readiness = getReadinessStatus({
    currentWeekKm,
    idealWeekKm,
    longestRunKm,
    longRuns28Plus: longRunsCount,
  });

  const bestHalf =
    runs
      .filter((a) => {
        const km = a.distance / 1000;
        return km >= 20 && km <= 22;
      })
      .sort((a, b) => a.moving_time - b.moving_time)[0] ?? null;

  const predictedFromHalf = predictFromHalf(bestHalf);
  const predictedFromLongRun = predictFromLongRun(longestRun);
  const predictedBySite = predictBySiteModel({ bestHalf, longestRun, weeklyData });
  const predictedFromVdotRange = predictFromVdot(config);

  // Recent long runs — buscar detalhes com FC se tiver accessToken
  const recentLongRunsBase = runs
    .filter((a) => a.distance >= 18000)
    .sort(
      (a, b) =>
        new Date(getActivityDate(b)).getTime() -
        new Date(getActivityDate(a)).getTime()
    )
    .slice(0, 5);

  // Enriquecer com dados detalhados (FC) quando possível
  const recentLongRuns = await Promise.all(
    recentLongRunsBase.map(async (run) => {
      // Se a atividade já tem FC (às vezes vem na listagem), usa direto
      if (run.average_heartrate) return run;
      // Caso contrário busca o detalhe
      if (accessToken) {
        const detail = await getActivityDetail(run.id, accessToken);
        if (detail?.average_heartrate) return { ...run, ...detail };
      }
      return run;
    })
  );

  const weeklyComparison = buildWeeklyComparison(sisrunData, activities, 8);

  const todayStatus = !todaySisrunRow
    ? "Sem treino previsto hoje"
    : todayStravaKm <= 0
    ? "Pendente"
    : todaySisrunRow.plannedDistanceKm > 0 &&
      todayStravaKm >= todaySisrunRow.plannedDistanceKm
    ? "Concluído"
    : "Parcial";

  const alerts = buildBuenosAiresAlerts({
    hasPlan: Boolean(sisrunWeek),
    plannedWeekKm,
    currentWeekKm,
    adherencePct: weeklyAdherencePct,
    plannedLongRunKm: sisrunWeek?.longRunPlannedKm ?? 0,
    currentWeekLongestRunKm,
    todayStatus,
    config,
  });

  // Zonas do atleta para usar nos componentes
  const hrZones = config?.hrZones ?? [];
  const hrMax = config?.hrMax ?? 184;

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Road to Buenos Aires</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {athlete ? `${athlete.firstname} ${athlete.lastname}` : "Atleta"}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Voltar ao dashboard
          </Link>
        </div>

        {/* Hero */}
        <section className="mb-8 rounded-[32px] bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white shadow-sm md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <p className="text-sm uppercase tracking-wide text-orange-100">Prova-alvo</p>
              <h2 className="mt-2 text-4xl font-bold md:text-5xl">{marathonGoal.raceName}</h2>
              <p className="mt-4 max-w-2xl text-orange-50">
                Painel dedicado ao ciclo com foco em volume, longão, especificidade e prontidão para a maratona.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/15 p-5 backdrop-blur-sm">
                  <p className="text-sm text-orange-100">Dias para a prova</p>
                  <p className="mt-1 text-3xl font-bold">{daysToRace}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-5 backdrop-blur-sm">
                  <p className="text-sm text-orange-100">Pace-alvo</p>
                  <p className="mt-1 text-3xl font-bold">{targetPaceLabel}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-5 backdrop-blur-sm">
                  <p className="text-sm text-orange-100">Tempo projetado</p>
                  <p className="mt-1 text-3xl font-bold">
                    {formatFullDuration(targetPredictionSeconds)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 text-gray-900">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${readiness.dot}`} />
                <div>
                  <p className={`font-semibold ${readiness.text}`}>{readiness.title}</p>
                  <p className="text-sm text-gray-500">{readiness.label}</p>
                </div>
              </div>
              <div className={`mt-4 rounded-2xl border p-4 ${readiness.card}`}>
                <p className={`font-medium ${readiness.text}`}>{readiness.description}</p>
              </div>
              <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Fase do ciclo</p>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${cyclePhase.color}`}>
                    {cyclePhase.name}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">{cyclePhase.description}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Info cards */}
        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Semana planejada (SisRUN)"
            value={sisrunWeek ? `${plannedWeekKm.toFixed(1)} km` : "-"}
          />
          <InfoCard
            title="Semana feita (Strava)"
            value={`${currentWeekKm.toFixed(1)} km`}
          />
          <InfoCard
            title="Aderência real"
            value={sisrunWeek ? `${Math.min(weeklyAdherencePct, 100).toFixed(0)}%` : "-"}
          />
          <InfoCard
            title="Longão previsto x feito"
            value={
              sisrunWeek
                ? `${sisrunWeek.longRunPlannedKm.toFixed(1)} / ${currentWeekLongestRunKm.toFixed(1)} km`
                : `${currentWeekLongestRunKm.toFixed(1)} km`
            }
          />
        </section>

        {/* Treino de hoje + Meta semanal */}
        <section className="grid gap-4 mb-8 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Treino de hoje</h3>
            {todaySisrunRow ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  Planejado:{" "}
                  <span className="font-semibold">{todaySisrunRow.plannedDistanceKm.toFixed(1)} km</span>
                </p>
                <p className="text-sm text-gray-600">
                  Feito no Strava:{" "}
                  <span className="font-semibold">{todayStravaKm.toFixed(1)} km</span>
                </p>
                <p className="text-sm text-gray-600">
                  Janela de tempo:{" "}
                  <span className="font-semibold">
                    {todaySisrunRow.minPlannedTime ?? "-"} / {todaySisrunRow.maxPlannedTime ?? "-"}
                  </span>
                </p>
                <p className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                  {todayStatus}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Nenhum treino previsto para hoje.</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Meta semanal</h3>
            <p className="mt-1 text-sm text-gray-500">
              Planejado no SisRUN x executado no Strava.
            </p>
            <div className="mt-4 rounded-2xl bg-gray-50 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progresso real</span>
                <span className="font-medium text-gray-900">
                  {currentWeekKm.toFixed(1)} /{" "}
                  {sisrunWeek ? plannedWeekKm.toFixed(1) : weeklyGoalKm.toFixed(1)} km
                </span>
              </div>
              <div className="mt-3 h-4 w-full rounded-full bg-gray-200">
                <div
                  className="h-4 rounded-full bg-orange-500"
                  style={{
                    width: `${
                      sisrunWeek
                        ? Math.min(weeklyAdherencePct, 100)
                        : weeklyProgress
                    }%`,
                  }}
                />
              </div>
              {sisrunWeek ? (
                <>
                  <p className="mt-3 text-sm text-gray-600">
                    Faltam {Math.max(plannedWeekKm - currentWeekKm, 0).toFixed(1)} km para cumprir o planejado da semana.
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Planejado: {plannedWeekKm.toFixed(1)} km • Executado:{" "}
                    {currentWeekKm.toFixed(1)} km
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-gray-600">
                    Faltam {Math.max(weeklyGoalKm - currentWeekKm, 0).toFixed(1)} km para cumprir a meta configurada.
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Você está {Math.abs(weekVsIdealDifference).toFixed(1)} km{" "}
                    {weekVsIdealDifference >= 0 ? "acima" : "abaixo"} da referência ideal da fase atual.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Alertas */}
        <section className="grid gap-4 mb-8 md:grid-cols-2">
          {alerts.map((alert, index) => (
            <div key={index} className={`rounded-3xl p-5 shadow-sm ${alert.tone}`}>
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-2 text-sm">{alert.text}</p>
            </div>
          ))}
        </section>

        {/* Gráfico semanal */}
        <section className="mb-8">
          <WeeklyComparisonChart
            items={weeklyComparison}
            title="Planejado x executado por semana"
            subtitle="Comparação entre o volume semanal do SisRUN e o que saiu no Strava."
          />
        </section>

        {/* ─── NOVO: VO2max + Zonas cardíacas ─────────────────────────────── */}
        {config && (
          <section className="mb-8 grid gap-4 lg:grid-cols-2">

            {/* Card VO2max */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">VO2max estimado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Calculado a partir de {config.vo2maxSources.join(" e ")}.
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  VDOT {config.vdot}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm text-blue-600">VO2max</p>
                  <p className="mt-1 text-3xl font-bold text-blue-700">{config.vo2max}</p>
                  <p className="text-xs text-blue-500">ml/kg/min</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Limiar de lactato</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{config.lactateThreshold}</p>
                  <p className="text-xs text-gray-400">bpm</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">FC máxima</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{config.hrMax}</p>
                  <p className="text-xs text-gray-400">bpm · Coros</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">FC repouso</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{config.hrRest}</p>
                  <p className="text-xs text-gray-400">bpm · Coros</p>
                </div>
              </div>

              {/* Barra de classificação */}
              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="mb-2 text-sm text-gray-500">Classificação (homem 40–49 anos)</p>
                <div className="relative h-3 w-full overflow-hidden rounded-full">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "linear-gradient(to right, #F09595, #FAC775, #97C459, #1D9E75, #0F6E56)",
                    }}
                  />
                  {/* Marcador na posição ~62% (VO2max 55 numa escala 33–70+) */}
                  <div
                    className="absolute top-0 h-full w-1 rounded-full bg-blue-600"
                    style={{ left: "62%" }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>Fraco ≤33</span>
                  <span>Razoável</span>
                  <span>Bom</span>
                  <span>Ótimo</span>
                  <span>Elite 58+</span>
                </div>
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  Bom a ótimo — VO2max {config.vo2max} ml/kg/min
                </p>
              </div>

              {/* FC alvo para Buenos Aires */}
              <div className="mt-4 rounded-2xl bg-orange-50 p-4">
                <p className="text-sm font-medium text-orange-700">FC alvo em Buenos Aires</p>
                <p className="mt-1 text-2xl font-bold text-orange-900">148–155 bpm</p>
                <p className="mt-1 text-sm text-orange-600">
                  Zona de potência aeróbica → limiar. ~10 bpm abaixo das meias.
                </p>
              </div>
            </div>

            {/* Card Zonas cardíacas */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">Zonas cardíacas</h3>
              <p className="mt-1 text-sm text-gray-500">
                Baseadas no limiar de lactato do Coros. FCmáx: {config.hrMax} bpm.
              </p>

              <div className="mt-5 space-y-2">
                {hrZones.map((zone) => {
                  const isMarathonZone = zone.name === "Potência aeróbica";
                  const isRaceZone = zone.name === "Limiar";
                  const rangeLabel =
                    zone.min === 0
                      ? `< ${zone.max + 1}`
                      : zone.max === 999
                      ? `> ${zone.min - 1}`
                      : `${zone.min}–${zone.max}`;

                  return (
                    <div
                      key={zone.name}
                      className={`flex items-center gap-3 rounded-2xl p-3 ${
                        isRaceZone
                          ? "bg-blue-50 ring-1 ring-blue-200"
                          : isMarathonZone
                          ? "bg-orange-50"
                          : "bg-gray-50"
                      }`}
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${
                              isRaceZone ? "text-blue-800" : "text-gray-800"
                            }`}
                          >
                            {zone.name}
                          </p>
                          {isRaceZone && (
                            <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-800">
                              Berlim · Lisboa
                            </span>
                          )}
                          {isMarathonZone && (
                            <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs text-orange-800">
                              Alvo Buenos Aires
                            </span>
                          )}
                        </div>
                      </div>
                      <p
                        className={`shrink-0 text-sm font-semibold ${
                          isRaceZone ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {rangeLabel} bpm
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Provas nas zonas */}
              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">% FCmáx nas provas</p>
                <div className="space-y-2">
                  {[
                    { name: "Berlim", bpm: 159 },
                    { name: "Lisboa", bpm: 160 },
                    { name: "SP (meia)", bpm: 152 },
                  ].map((prova) => (
                    <div key={prova.name} className="flex items-center gap-3">
                      <span className="w-20 text-sm text-gray-600">{prova.name}</span>
                      <div className="flex-1 rounded-full bg-gray-200" style={{ height: 8 }}>
                        <div
                          className="rounded-full"
                          style={{
                            width: `${getHrPctMax(prova.bpm, hrMax)}%`,
                            height: 8,
                            backgroundColor:
                              getHrZoneForBpm(prova.bpm, hrZones)?.color ?? "#888",
                          }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm font-medium text-gray-700">
                        {prova.bpm} bpm ({getHrPctMax(prova.bpm, hrMax)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Projeções + Longões recentes */}
        <section className="grid gap-4 mb-8 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Projeções da maratona</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comparação entre alvo, leituras automáticas, VDOT e previsão manual.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ProjectionCard
                title="Pelo pace-alvo"
                value={formatFullDuration(targetPredictionSeconds)}
                caption={targetPaceLabel}
              />

              <ProjectionCard
                title="Pela melhor meia"
                value={
                  predictedFromHalf && bestHalf
                    ? formatFullDuration(predictedFromHalf)
                    : "Sem dado"
                }
                caption={
                  predictedFromHalf && bestHalf
                    ? `${bestHalf.name} • ${formatDate(bestHalf.start_date_local)}`
                    : "Nenhuma meia encontrada no recorte."
                }
              />

              <ProjectionCard
                title="Pelo longão mais forte"
                value={
                  predictedFromLongRun && longestRun
                    ? formatFullDuration(predictedFromLongRun)
                    : "Sem dado"
                }
                caption={
                  predictedFromLongRun && longestRun
                    ? `${longestRun.name} • ${(longestRun.distance / 1000).toFixed(1)} km`
                    : "Ainda falta um longão mais robusto."
                }
              />

              <ProjectionCard
                title="Projeção calculada pelo site"
                value={predictedBySite ? formatFullDuration(predictedBySite) : "Sem dado"}
                caption={
                  predictedBySite
                    ? "Modelo híbrido com meia, longão e consistência semanal."
                    : "Dados insuficientes para projeção."
                }
                highlight
              />

              {/* NOVA: Projeção VDOT */}
              {predictedFromVdotRange && (
                <div className="col-span-full rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-200">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-blue-600">Por VDOT {config?.vdot}</p>
                    <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                      Berlim + Lisboa
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-blue-900">
                    {formatDurationShort(predictedFromVdotRange.min)}–
                    {formatDurationShort(predictedFromVdotRange.max)}
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    Pace{" "}
                    {config
                      ? `${formatSecondsPerKm(config.vdotPaces.marathon.minSecondsPerKm)}–${formatSecondsPerKm(config.vdotPaces.marathon.maxSecondsPerKm)}`
                      : "—"}{" "}
                    · VO2max {config?.vo2max} ml/kg/min · FC alvo 148–155 bpm
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4">
              <ManualPredictionForm initialValue={manualPredictions.stravaMarathonPrediction} />
            </div>
          </div>

          {/* Longões recentes — agora com pace e FC */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Longões recentes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Foco nos treinos mais relevantes para a maratona.
            </p>

            <div className="mt-5 space-y-3">
              {recentLongRuns.length > 0 ? (
                recentLongRuns.map((run) => {
                  const km = run.distance / 1000;
                  const paceSecPerKm = run.moving_time / km;
                  const paceLabel = formatSecondsPerKm(paceSecPerKm);
                  const hr = run.average_heartrate;

                  return (
                    <div
                      key={run.id}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{run.name}</p>
                          <p className="text-sm text-gray-500">
                            {km.toFixed(1)} km • {formatDate(run.start_date_local)}
                          </p>
                        </div>
                        {hr && hrZones.length > 0 && (
                          <HrZoneBadge bpm={Math.round(hr)} zones={hrZones} hrMax={hrMax} />
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {paceLabel}
                        </span>
                        {hr ? (
                          <span
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor:
                                getHrZoneForBpm(Math.round(hr), hrZones)?.color ?? "#888",
                            }}
                          >
                            {Math.round(hr)} bpm
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400">
                            FC não disponível
                          </span>
                        )}
                        {run.total_elevation_gain > 0 && (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                            +{Math.round(run.total_elevation_gain)}m alt.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500">Nenhum longão identificado ainda.</p>
              )}
            </div>
          </div>
        </section>

        {/* Resumo estratégico */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900">Resumo estratégico</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Leitura do momento</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                O alvo configurado está em{" "}
                <span className="font-semibold">{targetPaceLabel}</span>, projetando{" "}
                <span className="font-semibold">{formatFullDuration(targetPredictionSeconds)}</span>. Hoje, o
                ciclo está em <span className="font-semibold">{cyclePhase.name}</span> e o semáforo
                está em{" "}
                <span className={`font-semibold ${readiness.text}`}>{readiness.label}</span>.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Planejado x executado</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {sisrunWeek ? (
                  <>
                    O SisRUN prevê{" "}
                    <span className="font-semibold">{plannedWeekKm.toFixed(1)} km</span> nesta
                    semana, e o Strava mostra{" "}
                    <span className="font-semibold">{currentWeekKm.toFixed(1)} km</span> executados
                    até agora.
                  </>
                ) : (
                  <>Sem semana do SisRUN carregada. Usando apenas o executado no Strava.</>
                )}
              </p>
            </div>

            {/* NOVO: Bloco VO2max no resumo */}
            {config && (
              <div className="rounded-2xl bg-blue-50 p-5">
                <p className="text-sm text-blue-600">Potencial pelo VO2max</p>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  Seu VO2max estimado de{" "}
                  <span className="font-semibold">{config.vo2max} ml/kg/min</span> (VDOT{" "}
                  {config.vdot}) indica potencial para{" "}
                  <span className="font-semibold">
                    {config
                      ? `${formatSecondsPerKm(config.vdotPaces.marathon.minSecondsPerKm)}–${formatSecondsPerKm(config.vdotPaces.marathon.maxSecondsPerKm)}`
                      : "—"}
                  </span>{" "}
                  na maratona. O pace-alvo atual está conservador — há margem para ajustar conforme o
                  ciclo evolui.
                </p>
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

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

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date_local: string;
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

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return [];

    const res = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=80",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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

async function getAthlete(): Promise<Athlete | null> {
  try {
    const accessToken = await getValidStravaAccessToken();
    if (!accessToken) return null;

    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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
    return {
      stravaMarathonPrediction: "03:49:00",
    };
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFullDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}h ${String(minutes).padStart(2, "0")}min ${String(secs).padStart(2, "0")}s`;
}

function formatSecondsPerKm(secondsPerKm: number) {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

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

  if (days > 140) {
    return {
      name: "Base",
      description: "Consolidar consistência, volume e resistência geral.",
      color: "bg-sky-100 text-sky-700",
    };
  }

  if (days > 70) {
    return {
      name: "Construção",
      description: "Aumentar volume e trazer mais especificidade para a maratona.",
      color: "bg-amber-100 text-amber-700",
    };
  }

  if (days > 21) {
    return {
      name: "Pico",
      description: "Bloco mais específico, com longões fortes e sessões-chave.",
      color: "bg-orange-100 text-orange-700",
    };
  }

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

  const halfSeconds = half.moving_time;
  return Math.round(halfSeconds * Math.pow(42.195 / 21.0975, 1.06));
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

    if (recentWeeklyAverage >= 60) {
      base -= 120;
    } else if (recentWeeklyAverage < 40) {
      base += 180;
    }

    return base;
  }

  if (halfPrediction) {
    let base = halfPrediction;

    if (recentWeeklyAverage >= 60) {
      base -= 90;
    } else if (recentWeeklyAverage < 40) {
      base += 180;
    }

    return base;
  }

  if (longRunPrediction) {
    return longRunPrediction;
  }

  return null;
}

function buildBuenosAiresAlerts(params: {
  hasPlan: boolean;
  plannedWeekKm: number;
  currentWeekKm: number;
  adherencePct: number;
  plannedLongRunKm: number;
  currentWeekLongestRunKm: number;
  todayStatus: string;
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

  return alerts;
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
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
}: {
  title: string;
  value: string;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "bg-orange-50" : "bg-gray-50"}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{caption}</p>
    </div>
  );
}

export default async function BuenosAiresPage() {
  const [athlete, activities, manualPredictions, sisrunData] = await Promise.all([
    getAthlete(),
    getActivities(),
    getManualPredictions(),
    getSisrunData(),
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

  const runs = activities.filter((activity) => activity.type === "Run");

  const longestRun =
    runs.length > 0
      ? runs.reduce((max, activity) =>
          activity.distance > max.distance ? activity : max
        )
      : null;

  const longestRunKm = longestRun ? longestRun.distance / 1000 : 0;

  const weekMap = new Map<string, { label: string; distanceKm: number }>();

  runs.forEach((activity) => {
    const date = new Date(activity.start_date_local);
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
  const targetPredictionSeconds = marathonTimeFromPace(
    marathonGoal.targetPaceSecondsPerKm
  );

  const longRuns = runs.filter((activity) => activity.distance >= 28000);
  const longRunsCount = longRuns.length;
  const distanceToWeeklyGoal = Math.max(plannedWeekKm - currentWeekKm, 0);

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
      .filter((activity) => {
        const km = activity.distance / 1000;
        return km >= 20 && km <= 22;
      })
      .sort((a, b) => a.moving_time - b.moving_time)[0] ?? null;

  const predictedFromHalf = predictFromHalf(bestHalf);
  const predictedFromLongRun = predictFromLongRun(longestRun);
  const predictedBySite = predictBySiteModel({
    bestHalf,
    longestRun,
    weeklyData,
  });

  const recentLongRuns = runs
    .filter((activity) => activity.distance >= 18000)
    .sort(
      (a, b) =>
        new Date(b.start_date_local).getTime() -
        new Date(a.start_date_local).getTime()
    )
    .slice(0, 5);

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
  });

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
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

        <section className="mb-8 rounded-[32px] bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white shadow-sm md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <p className="text-sm uppercase tracking-wide text-orange-100">
                Prova-alvo
              </p>
              <h2 className="mt-2 text-4xl font-bold md:text-5xl">
                {marathonGoal.raceName}
              </h2>
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
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${cyclePhase.color}`}
                  >
                    {cyclePhase.name}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">{cyclePhase.description}</p>
              </div>
            </div>
          </div>
        </section>

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

        <section className="grid gap-4 mb-8 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Treino de hoje</h3>

            {todaySisrunRow ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  Planejado: <span className="font-semibold">{todaySisrunRow.plannedDistanceKm.toFixed(1)} km</span>
                </p>
                <p className="text-sm text-gray-600">
                  Feito no Strava: <span className="font-semibold">{todayStravaKm.toFixed(1)} km</span>
                </p>
                <p className="text-sm text-gray-600">
                  Janela de tempo: <span className="font-semibold">{todaySisrunRow.minPlannedTime ?? "-"} / {todaySisrunRow.maxPlannedTime ?? "-"}</span>
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
                  {currentWeekKm.toFixed(1)} / {sisrunWeek ? plannedWeekKm.toFixed(1) : weeklyGoalKm.toFixed(1)} km
                </span>
              </div>

              <div className="mt-3 h-4 w-full rounded-full bg-gray-200">
                <div
                  className="h-4 rounded-full bg-orange-500"
                  style={{
                    width: `${sisrunWeek ? Math.min(weeklyAdherencePct, 100) : weeklyProgress}%`,
                  }}
                />
              </div>

              {sisrunWeek ? (
                <>
                  <p className="mt-3 text-sm text-gray-600">
                    Faltam {Math.max(plannedWeekKm - currentWeekKm, 0).toFixed(1)} km para cumprir o planejado da semana.
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    Planejado: {plannedWeekKm.toFixed(1)} km • Executado: {currentWeekKm.toFixed(1)} km
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-gray-600">
                    Faltam {Math.max(weeklyGoalKm - currentWeekKm, 0).toFixed(1)} km para cumprir a meta configurada.
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    Você está {Math.abs(weekVsIdealDifference).toFixed(1)} km {weekVsIdealDifference >= 0 ? "acima" : "abaixo"} da referência ideal da fase atual.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 mb-8 md:grid-cols-2">
          {alerts.map((alert, index) => (
            <div key={index} className={`rounded-3xl p-5 shadow-sm ${alert.tone}`}>
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-2 text-sm">{alert.text}</p>
            </div>
          ))}
        </section>

        <section className="mb-8">
          <WeeklyComparisonChart
            items={weeklyComparison}
            title="Planejado x executado por semana"
            subtitle="Comparação entre o volume semanal do SisRUN e o que saiu no Strava."
          />
        </section>

        <section className="grid gap-4 mb-8 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Projeções da maratona</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comparação entre alvo, leituras automáticas e previsão manual do Strava.
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
                    : "Ainda falta um longão mais robusto para essa leitura."
                }
              />

              <ProjectionCard
                title="Projeção calculada pelo site"
                value={predictedBySite ? formatFullDuration(predictedBySite) : "Sem dado"}
                caption={
                  predictedBySite
                    ? "Modelo híbrido com meia, longão e consistência semanal."
                    : "Dados insuficientes para projeção do site."
                }
                highlight
              />
            </div>

            <div className="mt-4">
              <ManualPredictionForm
                initialValue={manualPredictions.stravaMarathonPrediction}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Longões recentes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Foco nos treinos mais relevantes para a maratona.
            </p>

            <div className="mt-5 space-y-3">
              {recentLongRuns.length > 0 ? (
                recentLongRuns.map((run) => (
                  <div key={run.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="font-semibold text-gray-900">{run.name}</p>
                    <p className="text-sm text-gray-600">
                      {(run.distance / 1000).toFixed(1)} km • {formatDate(run.start_date_local)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Nenhum longão identificado ainda.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900">Resumo estratégico</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Leitura do momento</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                O alvo configurado está em <span className="font-semibold">{targetPaceLabel}</span>,
                projetando <span className="font-semibold">{formatFullDuration(targetPredictionSeconds)}</span>.
                Hoje, o ciclo está em <span className="font-semibold">{cyclePhase.name}</span> e o
                semáforo está em <span className={`font-semibold ${readiness.text}`}>{readiness.label}</span>.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Planejado x executado</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {sisrunWeek ? (
                  <>
                    O SisRUN prevê <span className="font-semibold">{plannedWeekKm.toFixed(1)} km</span> nesta semana,
                    e o Strava mostra <span className="font-semibold">{currentWeekKm.toFixed(1)} km</span> executados até agora.
                  </>
                ) : (
                  <>Sem semana do SisRUN carregada. Usando apenas o executado no Strava.</>
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
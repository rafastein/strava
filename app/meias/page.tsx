export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import {
  getStravaActivities,
  getStravaActivityDetail,
  getStravaActivityLaps,
  isRunActivity,
  STRAVA_2024_START_EPOCH,
  type StravaActivitySummary,
  type StravaLap,
  type StravaSplit,
} from "../lib/strava-client";
import HalfMarathonComparison from "../components/HalfMarathonComparison";
import type { HalfMarathonEntry } from "../components/HalfMarathonComparison";

type StravaActivity = StravaActivitySummary;
type HalfSplitSource = "splits_metric" | "laps" | "estimated";
type HalfSplitsResult = {
  splits: HalfMarathonEntry["splits"];
  source: HalfSplitSource;
};
type StravaActivityDetailWithSplits = StravaActivitySummary & {
  splits_metric?: StravaSplit[] | null;
  laps?: StravaLap[] | null;
};

const HALF_MARATHON_MIN_M = 19_500;
const HALF_MARATHON_MAX_M = 23_500;

async function getActivities(token: string): Promise<StravaActivity[]> {
  return getStravaActivities({
    accessToken: token,
    after: STRAVA_2024_START_EPOCH,
    maxPages: 10,
  });
}

function toComparisonSplit(split: StravaSplit): HalfMarathonEntry["splits"][number] | null {
  const distanceM = split.distance ?? 0;
  const movingTimeSec = split.moving_time ?? 0;
  const paceSecPerKm = distanceM > 0 && movingTimeSec > 0 ? (movingTimeSec / distanceM) * 1000 : 0;

  if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return null;

  return {
    km: split.split,
    paceSecPerKm: Math.round(paceSecPerKm),
    heartrate: split.average_heartrate ? Math.round(split.average_heartrate) : null,
    distanceM: Math.round(distanceM),
  };
}

function convertMetricSplits(rawSplits: StravaSplit[] | null | undefined): HalfMarathonEntry["splits"] {
  if (!Array.isArray(rawSplits)) return [];

  return rawSplits
    .map(toComparisonSplit)
    .filter((split): split is HalfMarathonEntry["splits"][number] => Boolean(split));
}

function convertLaps(laps: StravaLap[] | null | undefined): HalfMarathonEntry["splits"] {
  if (!Array.isArray(laps)) return [];

  const splits: HalfMarathonEntry["splits"] = [];

  laps.forEach((lap, index) => {
    const distanceM = lap.distance ?? 0;
    const movingTimeSec = lap.moving_time ?? 0;
    const paceSecPerKm = distanceM > 0 && movingTimeSec > 0 ? (movingTimeSec / distanceM) * 1000 : 0;

    if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return;

    const roundedDistanceM = Math.round(distanceM);

    // Evita voltas manuais muito curtas/longas entrando como se fossem splits de km.
    if (roundedDistanceM < 750 || roundedDistanceM > 1_500) return;

    splits.push({
      km: lap.split ?? index + 1,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: lap.average_heartrate ? Math.round(lap.average_heartrate) : null,
      distanceM: roundedDistanceM,
    });
  });

  return splits;
}

function buildEstimatedSplits(activity: StravaActivity): HalfMarathonEntry["splits"] {
  const totalDistanceM = activity.distance ?? 0;
  const totalMovingTimeSec = activity.moving_time ?? 0;
  const paceSecPerKm = totalDistanceM > 0 && totalMovingTimeSec > 0
    ? (totalMovingTimeSec / totalDistanceM) * 1000
    : 0;

  if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) return [];

  const fullKilometers = Math.floor(totalDistanceM / 1000);
  const remainderM = Math.round(totalDistanceM - fullKilometers * 1000);
  const splits: HalfMarathonEntry["splits"] = [];

  for (let km = 1; km <= fullKilometers; km += 1) {
    splits.push({
      km,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      distanceM: 1000,
    });
  }

  if (remainderM >= 300) {
    splits.push({
      km: fullKilometers + 1,
      paceSecPerKm: Math.round(paceSecPerKm),
      heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      distanceM: remainderM,
    });
  }

  return splits;
}

async function getActivitySplits(
  activity: StravaActivity,
  token: string,
): Promise<HalfSplitsResult> {
  const detail = await getStravaActivityDetail(
    activity.id,
    token,
  ) as StravaActivityDetailWithSplits | null;

  const metricSplits = convertMetricSplits(detail?.splits_metric);
  if (metricSplits.length > 0) return { splits: metricSplits, source: "splits_metric" };

  const detailLaps = convertLaps(detail?.laps);
  if (detailLaps.length > 0) return { splits: detailLaps, source: "laps" };

  const apiLaps = convertLaps(await getStravaActivityLaps(activity.id, token));
  if (apiLaps.length > 0) return { splits: apiLaps, source: "laps" };

  return { splits: buildEstimatedSplits(activity), source: "estimated" };
}

function formatBRDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso.slice(0, 10); }
}

function cleanRaceName(name: string): string {
  return name
    .replace(/^\s*prova:\s*/i, "")
    .replace(/\s*\*{2,}\s*$/g, "")
    .trim();
}

export default async function MeiasPage() {
  const token = await getValidStravaAccessToken();
  const activities = token ? await getActivities(token) : [];

  const halvesBase = activities
    .filter((a) => isRunActivity(a) && a.distance >= HALF_MARATHON_MIN_M && a.distance <= HALF_MARATHON_MAX_M)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const halves: HalfMarathonEntry[] = [];

  if (token) {
    for (const activity of halvesBase) {
      const result = await getActivitySplits(activity, token);
      if (result.splits.length === 0) continue;

      halves.push({
        id: activity.id,
        name: cleanRaceName(activity.name),
        date: activity.start_date_local,
        distanceKm: Number((activity.distance / 1000).toFixed(2)),
        splits: result.splits,
        splitSource: result.source,
      });
    }
  }

  const estimatedCount = halves.filter((half) => half.splitSource === "estimated").length;

  const validPaces = halves.map((h) => {
    const ps = h.splits.map((s) => s.paceSecPerKm).filter((p) => p > 0 && p < 900);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
  });

  const bestIdx = validPaces.indexOf(Math.min(...validPaces.filter((p) => p > 0)));

  return (
    <div className="page"><Navbar />
    <main className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Análise</p>
            <h1 className="ba-title">Comparativo de Meias</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>
              {halves.length} meias exibidas desde jan/2024 — {halvesBase.length} candidatas encontradas no Strava.
            </p>
          </div>
          <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
        </div>

        {halves.length === 0 ? (
          <div className="ba-card" style={{ padding: "1.5rem" }}>
            <p className="ba-muted">
              {!token
                ? "Não consegui autenticar no Strava. Confira as variáveis STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET e STRAVA_REFRESH_TOKEN na Vercel."
                : halvesBase.length > 0
                  ? `Encontrei ${halvesBase.length} meia(s) candidata(s), mas o Strava não retornou splits/laps válidos para montar o gráfico.`
                  : "Nenhuma meia maratona encontrada no intervalo de 19,5 km a 23,5 km desde jan/2024."}
            </p>
          </div>
        ) : (
          <>
            <section className="ba-grid-4 ba-section">
              <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
                <p className="ba-label">Total de meias</p>
                <p className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem" }}>{halves.length}</p>
                <p className="ba-muted" style={{ marginTop: ".3rem" }}>desde jan/2024</p>
              </div>
              <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
                <p className="ba-label">Mais recente</p>
                <p className="ba-value" style={{ fontSize: "1rem", marginTop: ".4rem", lineHeight: 1.3 }}>{halves[0]?.name}</p>
                <p className="ba-muted" style={{ marginTop: ".3rem" }}>{formatBRDate(halves[0]?.date ?? "")}</p>
              </div>
              <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
                <p className="ba-label">Melhor prova</p>
                <p className="ba-value" style={{ fontSize: "1rem", marginTop: ".4rem", lineHeight: 1.3, color: "#10b981" }}>{halves[bestIdx]?.name ?? "-"}</p>
                <p className="ba-muted" style={{ marginTop: ".3rem" }}>{formatBRDate(halves[bestIdx]?.date ?? "")}</p>
              </div>
              <div className="ba-card" style={{ padding: "1.2rem", textAlign: "center" }}>
                <p className="ba-label">Evolução</p>
                <p className="ba-value" style={{ fontSize: "2rem", marginTop: ".4rem", color: "#60a5fa" }}>
                  {halves.length >= 2 ? (
                    (() => {
                      const first = validPaces[validPaces.length - 1];
                      const last = validPaces[0];
                      if (!first || !last) return "-";
                      const diffSec = Math.round(first - last);
                      return diffSec > 0 ? `-${diffSec}s/km` : `+${Math.abs(diffSec)}s/km`;
                    })()
                  ) : "-"}
                </p>
                <p className="ba-muted" style={{ marginTop: ".3rem" }}>1ª vs última prova</p>
              </div>
            </section>

            {estimatedCount > 0 ? (
              <div className="ba-card ba-section" style={{ padding: "1rem" }}>
                <p className="ba-muted">
                  {estimatedCount} prova(s) apareceram com linha estimada por pace médio porque o Strava não retornou splits/laps detalhados.
                </p>
              </div>
            ) : null}

            <section>
              <HalfMarathonComparison races={halves} />
            </section>
          </>
        )}
    </main>
    <footer className="site-footer">STRAVA · RAFAEL CABRAL · 2026</footer>
    </div>
  );
}

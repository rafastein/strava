export const dynamic = "force-dynamic";

import Link from "next/link";
import { getValidStravaAccessToken } from "../lib/strava-auth";
import HalfMarathonComparison from "../components/HalfMarathonComparison";
import type { HalfMarathonEntry } from "../components/HalfMarathonComparison";

type StravaSplit = {
  distance: number;
  moving_time: number;
  split: number;
  average_heartrate?: number | null;
};

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
};

const STRAVA_AFTER = Math.floor(new Date("2024-01-01T00:00:00Z").getTime() / 1000);

async function getActivities(): Promise<StravaActivity[]> {
  try {
    const token = await getValidStravaAccessToken();
    if (!token) return [];
    const all: StravaActivity[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}&after=${STRAVA_AFTER}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) break;
      const batch = (await res.json()) as StravaActivity[];
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 200) break;
    }
    return all;
  } catch { return []; }
}

async function getActivitySplits(
  id: number,
  token: string
): Promise<StravaSplit[]> {
  try {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.splits_metric ?? [];
  } catch { return []; }
}

function formatBRDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso.slice(0, 10); }
}

export default async function MeiasPage() {
  const token = await getValidStravaAccessToken();
  const activities = await getActivities();

  const halvesBase = activities
    .filter((a) => a.type === "Run" && a.distance >= 20000 && a.distance <= 22500)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const halves: HalfMarathonEntry[] = [];

  if (token) {
    for (const activity of halvesBase) {
      const rawSplits = await getActivitySplits(activity.id, token);
      if (rawSplits.length === 0) continue;

      const splits = rawSplits.map((s) => {
        const distM = s.distance ?? 0;
        const movSec = s.moving_time ?? 0;
        const paceSecPerKm = distM > 0 && movSec > 0 ? (movSec / distM) * 1000 : 0;
        return {
          km: s.split,
          paceSecPerKm: Math.round(paceSecPerKm),
          heartrate: s.average_heartrate ? Math.round(s.average_heartrate) : null,
        };
      });

      halves.push({
        id: activity.id,
        name: activity.name,
        date: activity.start_date_local,
        splits,
      });
    }
  }

  const validPaces = halves.map((h) => {
    const ps = h.splits.map((s) => s.paceSecPerKm).filter((p) => p > 0 && p < 900);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
  });

  const bestIdx = validPaces.indexOf(Math.min(...validPaces.filter((p) => p > 0)));

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="ba-section flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-600">Análise</p>
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Comparativo de meias maratonas
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {halves.length} meias encontradas desde jan/2024 — splits km a km sobrepostos.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            ← Voltar ao dashboard
          </Link>
        </div>

        {halves.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Nenhuma meia maratona com splits disponíveis encontrada.
            </p>
          </div>
        ) : (
          <>
            <section className="ba-section grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Total de meias</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{halves.length}</p>
                <p className="mt-1 text-xs text-gray-400">desde jan/2024</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Mais recente</p>
                <p className="mt-2 text-lg font-bold text-gray-900">{halves[0]?.name}</p>
                <p className="mt-1 text-xs text-gray-400">{formatBRDate(halves[0]?.date ?? "")}</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Melhor prova</p>
                <p className="mt-2 text-lg font-bold text-emerald-600">
                  {halves[bestIdx]?.name ?? "-"}
                </p>
                <p className="mt-1 text-xs text-gray-400">{formatBRDate(halves[bestIdx]?.date ?? "")}</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Evolução</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
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
                <p className="mt-1 text-xs text-gray-400">1ª vs última prova</p>
              </div>
            </section>

            <section>
              <HalfMarathonComparison races={halves} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

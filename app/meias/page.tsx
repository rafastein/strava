export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "../components/Navbar";
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

function cleanRaceName(name: string): string {
  return name
    .replace(/^\s*prova:\s*/i, "")
    .replace(/\s*\*{2,}\s*$/g, "")
    .trim();
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
          distanceM: Math.round(distM),
        };
      });

      halves.push({
        id: activity.id,
        name: cleanRaceName(activity.name),
        date: activity.start_date_local,
        distanceKm: Number((activity.distance / 1000).toFixed(2)),
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
    <div className="page"><Navbar />
    <main className="ba-page">
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Análise</p>
            <h1 className="ba-title">Comparativo de Meias</h1>
            <p className="ba-muted" style={{ marginTop: ".5rem" }}>{halves.length} meias encontradas desde jan/2024 — splits km a km sobrepostos.</p>
          </div>
          <Link href="/" className="ba-back">← Voltar ao dashboard</Link>
        </div>

        {halves.length === 0 ? (
          <div className="ba-card" style={{ padding: "1.5rem" }}>
            <p className="ba-muted">Nenhuma meia maratona com splits disponíveis encontrada.</p>
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

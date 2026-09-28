import Link from "next/link";
import type { StravaActivitySummary } from "../lib/strava-client";
import { formatArchiveDuration, getRecordedRaceTime } from "../lib/buenos-aires-archive";

export default function BuenosAiresMilestone({ race }: { race: StravaActivitySummary | null }) {
  const elapsed = getRecordedRaceTime(race);
  return (
    <div className="home-milestone">
      <div className="home-milestone__heading">
        <p className="ba-eyebrow">Buenos Aires · 20 set 2026</p>
        <span className="badge badge--success">Concluído</span>
      </div>
      <p className="home-milestone__title">42,195 km de história.</p>
      <p className="ba-muted home-milestone__copy">
        {elapsed
          ? `${formatArchiveDuration(elapsed)} de tempo decorrido no Strava. Uma conquista para guardar.`
          : "Missão cumprida. A preparação e a maratona agora fazem parte da sua trajetória."}
      </p>
      <Link href="/buenos-aires" className="ba-pill ba-pill-dark">Revisitar a conquista →</Link>
    </div>
  );
}

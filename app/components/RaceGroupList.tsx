import type { ReactNode } from "react";
import ActivitySplitsChart from "./ActivitySplitsChart";
import { getBRDateKey } from "../lib/date-utils";
import { formatDayMonth, formatKm, formatNumber } from "../lib/format";
import { getYearFromDateKey } from "../lib/season";
import { formatRaceEfficiency, formatRacePace, type RaceLikeEntry } from "../lib/strava-races";

// Listas de provas usadas nas páginas de mapas (Brasil e mundo).

export function parseRaceTimeToSeconds(time: string) {
  const parts = time.split(":").map(Number);
  if (parts.some(Number.isNaN)) return Number.POSITIVE_INFINITY;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number.POSITIVE_INFINITY;
}

export function getRacePaceSeconds(race: Pick<RaceLikeEntry, "time" | "distanceKm" | "paceSecPerKm">) {
  if (race.paceSecPerKm) return race.paceSecPerKm;
  const total = parseRaceTimeToSeconds(race.time);
  return Number.isFinite(total) && race.distanceKm ? total / race.distanceKm : Number.POSITIVE_INFINITY;
}

/** As `limit` provas de melhor pace entre as que passam no filtro. */
export function getTopRacesByPace(races: RaceLikeEntry[], filterFn: (race: RaceLikeEntry) => boolean, limit = 3) {
  return races
    .filter(filterFn)
    .filter((race) => Number.isFinite(getRacePaceSeconds(race)))
    .sort((a, b) => getRacePaceSeconds(a) - getRacePaceSeconds(b) || parseRaceTimeToSeconds(a.time) - parseRaceTimeToSeconds(b.time))
    .slice(0, limit);
}

function formatRaceDate(date: string) {
  const key = getBRDateKey(date);
  return key ? `${formatDayMonth(key)} ${getYearFromDateKey(key) ?? ""}`.trim() : "";
}

function cleanRaceName(name: string) {
  return name.replace(/^prova:\s*/i, "").replace(/^race:\s*/i, "").trim();
}

function racePlace(race: RaceLikeEntry) {
  return race.city && race.city !== "Não identificado" ? `${race.city}${race.state ? `, ${race.state}` : ""}` : null;
}

/** Pódio de uma distância: três linhas com tempo e pace. */
export function TopRacesList({ title, races }: { title: string; races: RaceLikeEntry[] }) {
  return (
    <div className="ui-section" style={{ paddingTop: 0, minWidth: 0 }}>
      <h3 className="ui-muted" style={{ padding: "0 4px", fontSize: 13, fontWeight: 600 }}>{title}</h3>
      {races.length === 0 ? (
        <p className="ui-card ui-card--pad ui-muted">Nenhuma prova nesta distância.</p>
      ) : (
        <div className="ui-card ui-list">
          {races.map((race, index) => (
            <a
              key={race.id}
              href={`https://www.strava.com/activities/${race.stravaId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-row ui-row--date"
            >
              <span className="ui-date">
                <span className="ui-date__day" style={index === 0 ? { color: "var(--ui-accent)" } : undefined}>{index + 1}º</span>
              </span>
              <span className="ui-row__main">
                <span className="ui-row__title">{cleanRaceName(race.name)}</span>
                <span className="ui-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[racePlace(race), formatRaceDate(race.date)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="ui-row__side">
                <span className={`ui-row__value${index === 0 ? " ui-row__value--accent" : ""}`}>{race.time}</span>
                <span className="ui-muted">{formatRacePace(getRacePaceSeconds(race))}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export type RaceGroup = {
  key: string;
  title: string;
  /** Bandeira ou outro elemento antes do título. */
  leading?: ReactNode;
  races: RaceLikeEntry[];
};

/** Grupos (estado ou país) que abrem para mostrar as provas, com detalhes e splits. */
export function RaceGroupList({
  groups,
  rankById,
  emptyText,
}: {
  groups: RaceGroup[];
  /** Posição no ranking geral de pace (1, 2, 3) para destacar na lista. */
  rankById?: Map<string, number>;
  emptyText: string;
}) {
  if (groups.length === 0) {
    return <p className="ui-card ui-card--pad ui-muted">{emptyText}</p>;
  }

  return (
    <div className="ui-card ui-list">
      {groups.map((group) => (
        <details key={group.key} className="ui-acc">
          <summary className="ui-row" style={{ minHeight: 56 }}>
            <span className="ui-row__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {group.leading}
              {group.title}
            </span>
            <span className="ui-muted" style={{ flexShrink: 0 }}>
              {group.races.length} {group.races.length === 1 ? "prova" : "provas"}
            </span>
          </summary>
          <div className="ui-acc__body" style={{ gap: 0, padding: 0 }}>
            {group.races.map((race, index) => {
              const rank = rankById?.get(race.id);
              return (
                <div key={race.id} className="race-item" style={index > 0 ? { borderTop: "1px solid var(--ui-border)" } : undefined}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <span className="ui-row__main">
                      <span style={{ fontSize: 15, fontWeight: 500 }}>
                        {cleanRaceName(race.name)}
                        {rank ? <span className="ui-tag-accent"> · {rank}º melhor pace</span> : null}
                      </span>
                      <span className="ui-muted">
                        {[racePlace(race), formatRaceDate(race.date), formatKm(race.distanceKm, 2)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="ui-row__side">
                      <span className="ui-row__value">{race.time}</span>
                      <span className="ui-muted">{formatRacePace(getRacePaceSeconds(race))}</span>
                    </span>
                  </div>
                  <p className="ui-muted">
                    {[
                      race.averageHeartrate ? `FC ${formatNumber(race.averageHeartrate)} bpm` : null,
                      `subida ${formatNumber(race.elevationGain ?? 0)} m`,
                      race.efficiency ? `eficiência ${formatRaceEfficiency(race.efficiency)}` : null,
                      race.gearName?.trim() ? `tênis ${race.gearName.trim()}` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <ActivitySplitsChart
                    activityId={race.stravaId}
                    activityName={cleanRaceName(race.name)}
                    targetPaceSecPerKm={race.paceSecPerKm ?? undefined}
                    goalPaceSecPerKm={320}
                  />
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

import type { CSSProperties } from "react";

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  type: string;
  start_date_local: string;
};

type BestEffort = {
  activityId: number;
  distanceM: number;
  timeSec: number;
  startDate: string;
  ageMonths: number;
  name: string;
};

type AthletePersonalRecords = {
  km5:      BestEffort | null;
  km10:     BestEffort | null;
  half:     BestEffort | null;
  marathon: BestEffort | null;
};

type SeasonRaceStatus = "completed" | "next" | "simulation" | "mission";

type SeasonRaceDef = {
  number: string;
  name: string;
  /** DD/MM */
  date: string;
  location: string;
  distanceKm: number;
  fixedStatus?: SeasonRaceStatus;
  /** se true, entra na timeline mesmo sem ser PR */
  featured: boolean;
  badge?: string;
};

type SeasonMonth = { label: string; races: SeasonRaceDef[] };

// ── Provas curadas ────────────────────────────────────────────────────────────
// featured: true  → sempre na timeline
// featured: false → só entra se for PR
const ALL_RACES: SeasonMonth[] = [
  {
    label: "JAN",
    races: [
      { number: "01", name: "Meia da Chapada",   date: "31/01", location: "Chapada",       distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "MAR",
    races: [
      { number: "02", name: "Meia de Lisboa", badge: "SuperHalfs",    date: "08/03", location: "Lisboa",        distanceKm: 21.1, featured: true },
      { number: "03", name: "Meia de Berlim", badge: "SuperHalfs",    date: "29/03", location: "Berlim",        distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "ABR",
    races: [
      { number: "04", name: "Meia de São Paulo", badge: "27 Capitais", date: "12/04", location: "São Paulo",     distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "MAI",
    races: [
      { number: "05", name: "100% Você 10K",     date: "01/05", location: "Brasil",        distanceKm: 10,   featured: false },
      { number: "06", name: "Circuito Serrano",  date: "16/05", location: "Brasil",        distanceKm: 5,    featured: false },
      { number: "07", name: "Meia de Lima", badge: "MegaFinisher",      date: "24/05", location: "Lima",          distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "JUN",
    races: [
      { number: "08", name: "Meia do Rio", badge: "27 Capitais",       date: "06/06", location: "Rio de Janeiro",distanceKm: 21.1, featured: true },
      { number: "09", name: "Praia Grande 10K",  date: "20/06", location: "Praia Grande",  distanceKm: 10,   featured: false },
      { number: "10", name: "Praia Grande 5K",   date: "21/06", location: "Praia Grande",  distanceKm: 5,    featured: false },
      { number: "11", name: "Meia de BH",        date: "28/06", location: "Belo Horizonte",distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "JUL",
    races: [
      { number: "12", name: "Cats Run",          date: "12/07", location: "Brasil",        distanceKm: 5,    featured: false },
      { number: "13", name: "Asics Run Challenge",date: "26/07",location: "Brasil",        distanceKm: 15,   featured: true },
    ],
  },
  {
    label: "AGO",
    races: [
      { number: "14", name: "Meia da Chapada",   date: "01/08", location: "Chapada",       distanceKm: 21.1, featured: true },
      { number: "15", name: "Meia da PF",        date: "09/08", location: "Brasília",      distanceKm: 21.1, featured: true },
      { number: "16", name: "Track & Field 15K", date: "16/08", location: "Brasília",      distanceKm: 15,   featured: true },
      { number: "17", name: "Quatro Poderes 10K",date: "22/08", location: "Brasília",      distanceKm: 10,   featured: false },
      { number: "18", name: "Run The Bridge",    date: "30/08", location: "Brasil",        distanceKm: 30,   fixedStatus: "simulation", featured: true },
    ],
  },
  {
    label: "SET",
    races: [
      { number: "19", name: "Buenos Aires",      date: "20/09", location: "Argentina",     distanceKm: 42,   fixedStatus: "mission",    featured: true },
    ],
  },
  {
    label: "OUT",
    races: [
      { number: "20", name: "Meia de Goiânia", badge: "27 Capitais",   date: "18/10", location: "Goiânia",       distanceKm: 21.1, featured: true },
    ],
  },
  {
    label: "NOV",
    races: [
      { number: "21", name: "Meia de Curitiba", badge: "27 Capitais",  date: "15/11", location: "Curitiba",      distanceKm: 21.1, featured: true },
    ],
  },
];

// Semestres para dividir a timeline
const S1_MONTHS = new Set(["JAN", "FEB", "MAR", "ABR", "MAI", "JUN"]);

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseRaceDate(ddmm: string): { month: number; day: number } {
  const [day, month] = ddmm.split("/").map(Number);
  return { month, day };
}

function prKeyFor(km: number): keyof AthletePersonalRecords | null {
  if (km >= 4.8  && km <= 5.3)   return "km5";
  if (km >= 9.7  && km <= 10.4)  return "km10";
  if (km >= 20.5 && km <= 21.8)  return "half";
  if (km >= 41.5 && km <= 43.0)  return "marathon";
  return null;
}

function findMatchingActivity(race: SeasonRaceDef, activities: StravaActivity[]): StravaActivity | null {
  const { month, day } = parseRaceDate(race.date);
  const raceTs = new Date(2026, month - 1, day).getTime();
  const ONE_DAY = 86_400_000;
  return activities.find((a) => {
    if (a.type !== "Run") return false;
    const actTs = new Date(a.start_date_local).getTime();
    if (Math.abs(actTs - raceTs) > ONE_DAY) return false;
    return a.distance / 1000 >= race.distanceKm * 0.9;
  }) ?? null;
}

type ResolvedEvent = {
  number: string;
  name: string;
  date: string;
  location: string;
  month: string;
  semester: 1 | 2;
  status: SeasonRaceStatus;
  result?: string;
  isPR: boolean;
  badge?: string;
};

function resolveEvents(
  activities: StravaActivity[],
  prs: AthletePersonalRecords | null,
): ResolvedEvent[] {
  const now = Date.now();
  const result: ResolvedEvent[] = [];

  for (const m of ALL_RACES) {
    for (const race of m.races) {
      if (race.fixedStatus) {
        result.push({
          number: race.number, name: race.name, date: race.date,
          location: race.location, month: m.label,
          semester: S1_MONTHS.has(m.label) ? 1 : 2,
          status: race.fixedStatus, isPR: false, badge: race.badge,
        });
        continue;
      }

      const match = findMatchingActivity(race, activities);
      const key = prKeyFor(race.distanceKm);
      const isPR = !!(match && key && prs && prs[key]?.activityId === match.id);

      // Provas não-featured só entram se forem PR
      if (!race.featured && !isPR) continue;

      if (match) {
        result.push({
          number: race.number, name: race.name, date: race.date,
          location: race.location, month: m.label,
          semester: S1_MONTHS.has(m.label) ? 1 : 2,
          status: "completed", result: formatTime(match.moving_time), isPR, badge: race.badge,
        });
        continue;
      }

      const { month: mo, day } = parseRaceDate(race.date);
      const raceTs = new Date(2026, mo - 1, day).getTime();
      const isPast = raceTs < now - 86_400_000;

      result.push({
        number: race.number, name: race.name, date: race.date,
        location: race.location, month: m.label,
        semester: S1_MONTHS.has(m.label) ? 1 : 2,
        status: isPast ? "completed" : "next", isPR: false, badge: race.badge,
      });
    }
  }

  return result;
}

function buildMonthGroups(events: ResolvedEvent[]) {
  const monthLabelIndexes = new Map<number, string>();
  const monthStartIndexes = new Set<number>();
  const groups: { month: string; start: number; end: number }[] = [];
  let lastMonth = "";
  events.forEach((e, i) => {
    if (e.month !== lastMonth) {
      groups.push({ month: e.month, start: i, end: i });
      lastMonth = e.month;
    } else {
      groups[groups.length - 1].end = i;
    }
  });
  groups.forEach(({ month, start, end }) => {
    const mid = Math.floor((start + end) / 2);
    monthLabelIndexes.set(mid, month);
    if (start > 0) monthStartIndexes.add(start);
  });
  return { monthLabelIndexes, monthStartIndexes };
}

function Timeline({ events, label }: { events: ResolvedEvent[]; label: string }) {
  const { monthLabelIndexes, monthStartIndexes } = buildMonthGroups(events);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{
        fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "rgba(255,255,255,0.28)",
        marginBottom: "0.65rem", fontFamily: "var(--font-mono)",
      }}>{label}</p>

      <div className="season-timeline">
        {events.map((race, idx) => {
          const showMonth = monthLabelIndexes.has(idx);
          const isMonthStart = monthStartIndexes.has(idx);
          const nodeClass =
            race.status === "completed"  ? "season-event__node--completed"
            : race.status === "simulation" ? "season-event__node--simulation"
            : race.status === "mission"    ? "season-event__node--mission"
            : "season-event__node--next";

          return (
            <div
              key={`${race.number}-${race.name}`}
              className={`season-event${isMonthStart ? " season-event--month-start" : ""}`}
            >
              <span className="season-event__month">
                {showMonth ? monthLabelIndexes.get(idx) : ""}
              </span>
              <span className={`season-event__node ${nodeClass}`} />
              <div className="season-event__label">
                <p className={`season-event__name season-event__name--${race.status}`}>
                  {race.name}
                </p>
                <p className="season-event__date">{race.date}</p>
                {race.result && (
                  <span className="season-event__result">{race.result}</span>
                )}
                {race.isPR && (
                  <span className="season-event__note">🏆 RP</span>
                )}
                {race.badge && (
                  <div><span className="season-event__badge">{race.badge}</span></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SeasonCalendar({
  activities,
  prs,
}: {
  activities: StravaActivity[];
  prs: AthletePersonalRecords | null;
}) {
  const events = resolveEvents(activities, prs);
  const s1 = events.filter((e) => e.semester === 1);
  const s2 = events.filter((e) => e.semester === 2);

  return (
    <section className="ba-card season-clean-card">
      <style>{`
        .season-clean-card {
          margin-bottom: 1.75rem;
          padding: 1.5rem 1.75rem 1.75rem;
        }

        .season-clean-header { margin-bottom: 1.35rem; }

        .season-timeline {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .season-timeline::before {
          content: "";
          position: absolute;
          left: 0; right: 0;
          top: calc(1.5rem + 2px);
          height: 1px;
          background: rgba(255,255,255,0.13);
          pointer-events: none;
        }

        /* divisor entre semestres */
        .season-semester-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin: 1.1rem 0 1.35rem;
        }

        .season-event {
          flex: 1 1 0;
          min-width: 5.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .season-event--month-start::before {
          content: "";
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 1px;
          background: rgba(255,255,255,0.10);
        }

        .season-event__month {
          height: 1.5rem;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          font-family: var(--font-mono);
          line-height: 1.5rem;
        }

        .season-event__node {
          width: 9px; height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
          position: relative; z-index: 1;
          margin-bottom: 0.75rem;
        }

        .season-event__node--completed {
          background: #34d399;
          box-shadow: 0 0 0 2px rgba(52,211,153,0.2), 0 0 8px rgba(52,211,153,0.4);
        }
        .season-event__node--next {
          background: transparent;
          border: 1.5px solid rgba(96,165,250,0.7);
          box-shadow: 0 0 6px rgba(96,165,250,0.25);
        }
        .season-event__node--simulation {
          background: rgba(96,165,250,0.18);
          border: 1.5px solid rgba(96,165,250,0.7);
          box-shadow: 0 0 8px rgba(96,165,250,0.35);
        }
        .season-event__node--mission {
          background: var(--accent);
          width: 11px; height: 11px;
          box-shadow: 0 0 10px rgba(245,166,35,0.55);
        }

        .season-event__label {
          text-align: center;
          padding: 0 0.15rem;
          width: 100%;
        }

        .season-event__name {
          font-size: 0.65rem;
          font-weight: 500;
          line-height: 1.2;
          margin-bottom: 0.25rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 1.56rem;
        }

        .season-event__name--completed  { color: rgba(52,211,153,0.75); }
        .season-event__name--next       { color: rgba(255,255,255,0.45); }
        .season-event__name--simulation { color: rgba(255,255,255,0.45); }
        .season-event__name--mission    { color: var(--accent); }

        .season-event__date {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.35);
          font-family: var(--font-mono);
          line-height: 1;
        }

        .season-event__result {
          display: inline-block;
          margin-top: 0.3rem;
          font-size: 0.62rem;
          font-family: var(--font-mono);
          color: #34d399;
          background: rgba(52,211,153,0.08);
          border: 1px solid rgba(52,211,153,0.18);
          border-radius: 999px;
          padding: 0.15rem 0.4rem;
        }

        .season-event__badge {
          display: inline-block;
          margin-top: 0.3rem;
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(192,132,252,0.85);
          background: rgba(168,85,247,0.08);
          border: 1px solid rgba(168,85,247,0.22);
          border-radius: 999px;
          padding: 0.15rem 0.4rem;
          white-space: nowrap;
        }

        .season-event__note {
          display: inline-block;
          margin-top: 0.3rem;
          margin-left: 0.2rem;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(245,166,35,0.8);
          background: rgba(245,166,35,0.08);
          border: 1px solid rgba(245,166,35,0.2);
          border-radius: 999px;
          padding: 0.15rem 0.4rem;
        }


        @media (max-width: 760px) {
          .season-clean-card {
            padding: 1.05rem;
            margin-bottom: 1.25rem;
            overflow: hidden;
          }

          .season-clean-header {
            margin-bottom: 1rem;
          }

          .season-timeline {
            display: grid;
            gap: 0.62rem;
            overflow-x: visible;
            padding: 0 0 0 0.9rem;
          }

          .season-timeline::before {
            left: 0.26rem;
            right: auto;
            top: 0.2rem;
            bottom: 0.2rem;
            width: 1px;
            height: auto;
            background: linear-gradient(
              180deg,
              rgba(52,211,153,0.35),
              rgba(245,166,35,0.35),
              rgba(96,165,250,0.30)
            );
          }

          .season-semester-divider {
            margin: 1rem 0 1.05rem;
          }

          .season-event {
            width: 100%;
            min-width: 0;
            display: grid;
            grid-template-columns: 2.8rem 0.8rem minmax(0, 1fr);
            align-items: center;
            column-gap: 0.55rem;
            padding: 0.42rem 0;
          }

          .season-event--month-start::before {
            display: none;
          }

          .season-event__month {
            height: auto;
            min-height: 1rem;
            line-height: 1;
            font-size: 0.62rem;
            color: var(--accent);
            text-align: right;
          }

          .season-event__node {
            margin: 0;
            justify-self: center;
          }

          .season-event__label {
            width: 100%;
            text-align: left;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            column-gap: 0.65rem;
            padding: 0.62rem 0.72rem;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            background: rgba(255,255,255,0.035);
          }

          .season-event__name {
            height: auto;
            margin: 0;
            font-size: 0.78rem;
            font-weight: 800;
            line-height: 1.15;
            -webkit-line-clamp: 1;
          }

          .season-event__date {
            grid-column: 2;
            grid-row: 1;
            font-size: 0.66rem;
            color: rgba(255,255,255,0.42);
            white-space: nowrap;
          }

          .season-event__result,
          .season-event__badge,
          .season-event__note {
            grid-column: 1 / -1;
            width: fit-content;
            margin-top: 0.35rem;
            margin-left: 0;
          }
        }

        @media (max-width: 420px) {
          .season-clean-card {
            padding: 0.95rem;
          }

          .season-event {
            grid-template-columns: 2.45rem 0.75rem minmax(0, 1fr);
            column-gap: 0.45rem;
          }

          .season-event__label {
            padding: 0.58rem 0.62rem;
          }

          .season-event__name {
            font-size: 0.74rem;
          }
        }

      `}</style>

      <div className="season-clean-header">
        <p className="ba-eyebrow">Calendário da temporada 2026</p>
      </div>

      <Timeline events={s1} label="1º semestre" />
      <div className="season-semester-divider" />
      <Timeline events={s2} label="2º semestre" />
    </section>
  );
}
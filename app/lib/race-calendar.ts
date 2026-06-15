import { getRedisClient } from "./redis-client";

export type RaceObjective = "Treino" | "Simulado" | "Prova" | "Missão";

export type DashboardRace = {
  name: string;
  date: string;
  location: string;
  distanceKm: number;
  objective: string;
  targetPaceSecPerKm: number | null;
  href?: string;
};

export type SeasonRaceStatus = "completed" | "next" | "simulation" | "mission";

export type SeasonRaceDef = {
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

export type SeasonMonth = { label: string; races: SeasonRaceDef[] };

export type MarathonCycleRace = {
  dateKey: string;
  name: string;
  location: string;
  distanceKm: number;
  isGoal?: boolean;
};

export type ManagedRace = {
  id: string;
  name: string;
  dateKey: string;
  location: string;
  distanceKm: number;
  objective: string;
  targetPaceSecPerKm: number | null;
  featured: boolean;
  badge?: string;
  fixedStatus?: SeasonRaceStatus;
  href?: string;
  isGoal?: boolean;
  timeLocal?: string;
  timezoneOffset?: string;
};

export type ManagedRaceResult = {
  races: ManagedRace[];
  source: "upstash" | "fallback";
  redisConfigured: boolean;
};

export type RaceCalendarData = ManagedRaceResult & {
  dashboardRaces: DashboardRace[];
  seasonMonths: SeasonMonth[];
  marathonCycleRaces: MarathonCycleRace[];
};

export const BUENOS_AIRES_RACE_ISO = "2026-09-20T06:00:00-03:00";
export const BUENOS_AIRES_RACE_DATE = new Date(BUENOS_AIRES_RACE_ISO);
export const MARATHON_CYCLE_START_ISO = "2026-05-18T00:00:00-03:00";
export const MARATHON_CYCLE_START_DATE = new Date(MARATHON_CYCLE_START_ISO);
export const MARATHON_CYCLE_END_ISO = "2026-09-20T23:59:59-03:00";
export const MARATHON_CYCLE_END_DATE = new Date(MARATHON_CYCLE_END_ISO);
export const BUENOS_AIRES_GOAL_PACE_SEC_PER_KM = 320;
export const BUENOS_AIRES_TARGET_WEEKLY_KM = 65;
export const BUENOS_AIRES_TARGET_LONG_RUN_KM = 30;
export const BUENOS_AIRES_MARATHON_DISTANCE_KM = 42.195;

const RACE_CALENDAR_KEY = "race-calendar:2026";
const DEFAULT_RACE_TIME = "07:00:00";
const DEFAULT_RACE_TIMEZONE = "-03:00";
const MONTH_LABELS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const S1_MONTH_INDEXES = new Set([0, 1, 2, 3, 4, 5]);

export const BUENOS_AIRES_GOAL = {
  raceName: "Maratona de Buenos Aires",
  date: BUENOS_AIRES_RACE_DATE,
  dateIso: BUENOS_AIRES_RACE_ISO,
  targetPaceSecondsPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM,
  targetWeeklyKm: BUENOS_AIRES_TARGET_WEEKLY_KM,
  targetLongRunKm: BUENOS_AIRES_TARGET_LONG_RUN_KM,
  distanceKm: BUENOS_AIRES_MARATHON_DISTANCE_KM,
} as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildRaceId(dateKey: string, name: string) {
  return `${dateKey}-${slugify(name) || "prova"}`;
}

function toDateIso(race: ManagedRace) {
  const time = race.timeLocal?.trim() || DEFAULT_RACE_TIME;
  const offset = race.timezoneOffset?.trim() || DEFAULT_RACE_TIMEZONE;
  return `${race.dateKey}T${time}${offset}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toSeasonDate(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return "--/--";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeRace(raw: Partial<ManagedRace>): ManagedRace | null {
  const name = String(raw.name ?? "").trim();
  const dateKey = String(raw.dateKey ?? "").trim();
  const location = String(raw.location ?? "").trim();
  const objective = String(raw.objective ?? "").trim() || "Treino";
  const distanceKm = Number(raw.distanceKm);
  const rawTargetPace = raw.targetPaceSecPerKm as unknown;
  const targetPaceSecPerKm = rawTargetPace === null || rawTargetPace === undefined || rawTargetPace === ""
    ? null
    : Number(rawTargetPace);
  const fixedStatus = raw.fixedStatus || undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  if (!name || !location) return null;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (targetPaceSecPerKm !== null && (!Number.isFinite(targetPaceSecPerKm) || targetPaceSecPerKm <= 0)) return null;
  if (fixedStatus && !["completed", "next", "simulation", "mission"].includes(fixedStatus)) return null;

  return {
    id: String(raw.id ?? "").trim() || buildRaceId(dateKey, name),
    name,
    dateKey,
    location,
    distanceKm,
    objective,
    targetPaceSecPerKm,
    featured: Boolean(raw.featured),
    badge: raw.badge?.trim() || undefined,
    fixedStatus,
    href: raw.href?.trim() || undefined,
    isGoal: Boolean(raw.isGoal),
    timeLocal: raw.timeLocal?.trim() || DEFAULT_RACE_TIME,
    timezoneOffset: raw.timezoneOffset?.trim() || DEFAULT_RACE_TIMEZONE,
  };
}

function sortRaces(races: ManagedRace[]) {
  return [...races].sort((a, b) => {
    const dateDiff = a.dateKey.localeCompare(b.dateKey);
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function sanitizeRaces(races: Array<Partial<ManagedRace>>) {
  const seen = new Set<string>();
  const sanitized: ManagedRace[] = [];

  for (const raw of races) {
    const race = normalizeRace(raw);
    if (!race) continue;
    const id = race.id || buildRaceId(race.dateKey, race.name);
    const uniqueRace = { ...race, id };
    if (seen.has(id)) continue;
    seen.add(id);
    sanitized.push(uniqueRace);
  }

  return sortRaces(sanitized);
}

export const DEFAULT_MANAGED_RACES: ManagedRace[] = sanitizeRaces([
  { id: "2026-01-31-meia-da-chapada", name: "Meia da Chapada", dateKey: "2026-01-31", location: "Chapada", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true },
  { id: "2026-03-08-meia-de-lisboa", name: "Meia de Lisboa", dateKey: "2026-03-08", location: "Lisboa", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true, badge: "SuperHalfs", timezoneOffset: "+00:00" },
  { id: "2026-03-29-meia-de-berlim", name: "Meia de Berlim", dateKey: "2026-03-29", location: "Berlim", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true, badge: "SuperHalfs", timezoneOffset: "+02:00" },
  { id: "2026-04-12-meia-de-sao-paulo", name: "Meia de São Paulo", dateKey: "2026-04-12", location: "São Paulo", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true, badge: "27 Capitais" },
  { id: "2026-05-01-100-voce-10k", name: "100% Você 10K", dateKey: "2026-05-01", location: "Brasil", distanceKm: 10, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-05-16-circuito-serrano", name: "Circuito Serrano", dateKey: "2026-05-16", location: "Brasil", distanceKm: 5, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-05-24-meia-de-lima", name: "Meia de Lima", dateKey: "2026-05-24", location: "Lima, Peru", distanceKm: 21.1, objective: "Pace de maratona (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM, featured: true, badge: "MegaFinisher", timezoneOffset: "-05:00" },
  { id: "2026-06-06-meia-do-rio", name: "Meia do Rio", dateKey: "2026-06-06", location: "Rio de Janeiro", distanceKm: 21.1, objective: "All-in — sub-1:45", targetPaceSecPerKm: 298, featured: true, badge: "27 Capitais" },
  { id: "2026-06-20-praia-grande-10k", name: "Praia Grande 10K", dateKey: "2026-06-20", location: "Praia Grande", distanceKm: 10, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-06-21-praia-grande-5k", name: "Praia Grande 5K", dateKey: "2026-06-21", location: "Praia Grande", distanceKm: 5, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-06-28-meia-de-bh", name: "Meia de BH", dateKey: "2026-06-28", location: "Belo Horizonte", distanceKm: 21.1, objective: "Treino", targetPaceSecPerKm: null, featured: true, badge: "27 Capitais" },
  { id: "2026-07-12-cats-run", name: "Cats Run", dateKey: "2026-07-12", location: "Brasil", distanceKm: 5, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-07-26-asics-run-challenge", name: "Asics Run Challenge", dateKey: "2026-07-26", location: "Brasil", distanceKm: 15, objective: "Treino", targetPaceSecPerKm: null, featured: true },
  { id: "2026-08-01-meia-da-chapada", name: "Meia da Chapada", dateKey: "2026-08-01", location: "Chapada", distanceKm: 21.1, objective: "Simulado/treino", targetPaceSecPerKm: null, featured: true },
  { id: "2026-08-09-meia-da-pf", name: "Meia da PF", dateKey: "2026-08-09", location: "Brasília", distanceKm: 21.1, objective: "Treino", targetPaceSecPerKm: null, featured: true },
  { id: "2026-08-16-track-field-15k", name: "Track & Field 15K", dateKey: "2026-08-16", location: "Brasília", distanceKm: 15, objective: "Treino", targetPaceSecPerKm: null, featured: true },
  { id: "2026-08-22-quatro-poderes-10k", name: "Quatro Poderes 10K", dateKey: "2026-08-22", location: "Brasília", distanceKm: 10, objective: "Treino", targetPaceSecPerKm: null, featured: false },
  { id: "2026-08-30-run-the-bridge", name: "Run The Bridge", dateKey: "2026-08-30", location: "Brasil", distanceKm: 30, objective: "Simulado 30km (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM, featured: true, fixedStatus: "simulation" },
  { id: "2026-09-20-buenos-aires", name: "Buenos Aires", dateKey: "2026-09-20", location: "Buenos Aires, Argentina", distanceKm: BUENOS_AIRES_MARATHON_DISTANCE_KM, objective: "Sub-3:45 (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM, featured: true, fixedStatus: "mission", href: "/buenos-aires", isGoal: true, timeLocal: "06:00:00" },
  { id: "2026-10-18-meia-de-goiania", name: "Meia de Goiânia", dateKey: "2026-10-18", location: "Goiânia", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true, badge: "27 Capitais" },
  { id: "2026-11-15-meia-de-curitiba", name: "Meia de Curitiba", dateKey: "2026-11-15", location: "Curitiba", distanceKm: 21.1, objective: "Prova", targetPaceSecPerKm: null, featured: true, badge: "27 Capitais" },
]);

export function toDashboardRaces(races: ManagedRace[]): DashboardRace[] {
  return sortRaces(races).map((race) => ({
    name: race.name,
    date: toDateIso(race),
    location: race.location,
    distanceKm: race.distanceKm,
    objective: race.objective,
    targetPaceSecPerKm: race.targetPaceSecPerKm,
    href: race.href,
  }));
}

export function toMarathonCycleRaces(races: ManagedRace[]): MarathonCycleRace[] {
  return sortRaces(races)
    .filter((race) => {
      const date = parseDateKey(race.dateKey);
      if (!date) return false;
      return date >= MARATHON_CYCLE_START_DATE && date <= MARATHON_CYCLE_END_DATE;
    })
    .map((race) => ({
      dateKey: race.dateKey,
      name: race.name,
      location: race.location,
      distanceKm: race.distanceKm,
      isGoal: race.isGoal,
    }));
}

export function toSeasonRaceMonths(races: ManagedRace[]): SeasonMonth[] {
  const sorted = sortRaces(races);
  const groups = new Map<string, SeasonRaceDef[]>();

  sorted.forEach((race, index) => {
    const date = parseDateKey(race.dateKey);
    if (!date) return;
    const label = MONTH_LABELS[date.getMonth()] ?? String(date.getMonth() + 1).padStart(2, "0");
    const raceDef: SeasonRaceDef = {
      number: String(index + 1).padStart(2, "0"),
      name: race.name,
      date: toSeasonDate(race.dateKey),
      location: race.location,
      distanceKm: race.distanceKm,
      featured: race.featured,
      badge: race.badge,
      fixedStatus: race.fixedStatus,
    };
    groups.set(label, [...(groups.get(label) ?? []), raceDef]);
  });

  return MONTH_LABELS
    .map((label) => ({ label, races: groups.get(label) ?? [] }))
    .filter((month) => month.races.length > 0);
}

export function isFirstSemesterMonthLabel(label: string) {
  const index = MONTH_LABELS.indexOf(label);
  return index >= 0 && S1_MONTH_INDEXES.has(index);
}

export const DASHBOARD_RACES = toDashboardRaces(DEFAULT_MANAGED_RACES);
export const SEASON_RACE_MONTHS = toSeasonRaceMonths(DEFAULT_MANAGED_RACES);
export const MARATHON_CYCLE_RACES = toMarathonCycleRaces(DEFAULT_MANAGED_RACES);

export async function getManagedRaces(): Promise<ManagedRaceResult> {
  const redis = await getRedisClient();
  if (!redis) {
    return { races: DEFAULT_MANAGED_RACES, source: "fallback", redisConfigured: false };
  }

  const raw = await redis.get<ManagedRace[]>(RACE_CALENDAR_KEY);
  const races = Array.isArray(raw) ? sanitizeRaces(raw) : [];

  if (!races.length) {
    return { races: DEFAULT_MANAGED_RACES, source: "fallback", redisConfigured: true };
  }

  return { races, source: "upstash", redisConfigured: true };
}

export async function saveManagedRaces(races: Array<Partial<ManagedRace>>) {
  const redis = await getRedisClient();
  if (!redis) throw new Error("Upstash/Redis não configurado.");

  const sanitized = sanitizeRaces(races);
  await redis.set(RACE_CALENDAR_KEY, sanitized);
  return { key: RACE_CALENDAR_KEY, races: sanitized };
}

export async function upsertManagedRace(raw: Partial<ManagedRace>) {
  const race = normalizeRace(raw);
  if (!race) throw new Error("Dados da prova inválidos.");

  const current = await getManagedRaces();
  const next = sanitizeRaces([
    ...current.races.filter((item) => item.id !== race.id),
    race,
  ]);

  const saved = await saveManagedRaces(next);
  return { ...saved, race };
}

export async function deleteManagedRace(id: string) {
  const cleanId = id.trim();
  if (!cleanId) throw new Error("Informe o ID da prova.");

  const current = await getManagedRaces();
  const next = current.races.filter((race) => race.id !== cleanId);

  if (next.length === current.races.length) {
    throw new Error("Prova não encontrada.");
  }

  const saved = await saveManagedRaces(next);
  return { ...saved, deletedId: cleanId };
}

export async function resetManagedRaces() {
  const saved = await saveManagedRaces(DEFAULT_MANAGED_RACES);
  return { ...saved, reset: true };
}

export async function getRaceCalendarData(): Promise<RaceCalendarData> {
  const result = await getManagedRaces();
  return {
    ...result,
    dashboardRaces: toDashboardRaces(result.races),
    seasonMonths: toSeasonRaceMonths(result.races),
    marathonCycleRaces: toMarathonCycleRaces(result.races),
  };
}

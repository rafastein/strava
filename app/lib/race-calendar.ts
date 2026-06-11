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

export const BUENOS_AIRES_GOAL = {
  raceName: "Maratona de Buenos Aires",
  date: BUENOS_AIRES_RACE_DATE,
  dateIso: BUENOS_AIRES_RACE_ISO,
  targetPaceSecondsPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM,
  targetWeeklyKm: BUENOS_AIRES_TARGET_WEEKLY_KM,
  targetLongRunKm: BUENOS_AIRES_TARGET_LONG_RUN_KM,
  distanceKm: BUENOS_AIRES_MARATHON_DISTANCE_KM,
} as const;

export const DASHBOARD_RACES: DashboardRace[] = [
  { name: "Circuito Serrano", date: "2026-05-16T07:00:00-03:00", location: "Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Meia Maratona de Lima", date: "2026-05-24T07:00:00-05:00", location: "Lima, Peru", distanceKm: 21.1, objective: "Pace de maratona (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM },
  { name: "Maratona do Rio", date: "2026-06-06T07:00:00-03:00", location: "Rio de Janeiro, Brasil", distanceKm: 21.1, objective: "All-in — sub-1:45", targetPaceSecPerKm: 298 },
  { name: "Maratona Intl Praia Grande (10km)", date: "2026-06-20T07:00:00-03:00", location: "Praia Grande, Brasil", distanceKm: 10.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Maratona Intl Praia Grande (5km)", date: "2026-06-21T07:00:00-03:00", location: "Praia Grande, Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Cats Run", date: "2026-07-12T07:00:00-03:00", location: "Brasil", distanceKm: 5.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Asics Run Challenge", date: "2026-07-26T07:00:00-03:00", location: "Brasil", distanceKm: 15.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Meia da Chapada", date: "2026-08-01T07:00:00-03:00", location: "Chapada dos Veadeiros, Brasil", distanceKm: 21.1, objective: "Simulado/treino", targetPaceSecPerKm: null },
  { name: "Meia Maratona da Polícia Federal", date: "2026-08-09T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 21.1, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Track & Field Run Series Conjunto", date: "2026-08-16T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 15.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Quatro Poderes Run", date: "2026-08-22T07:00:00-03:00", location: "Brasília, Brasil", distanceKm: 10.0, objective: "Treino", targetPaceSecPerKm: null },
  { name: "Run The Bridge", date: "2026-08-30T07:00:00-03:00", location: "Brasil", distanceKm: 30.0, objective: "Simulado 30km (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM },
  { name: "Maratona de Buenos Aires", date: BUENOS_AIRES_RACE_ISO, location: "Buenos Aires, Argentina", distanceKm: BUENOS_AIRES_MARATHON_DISTANCE_KM, objective: "Sub-3:45 (5:20/km)", targetPaceSecPerKm: BUENOS_AIRES_GOAL_PACE_SEC_PER_KM, href: "/buenos-aires" },
];

export const SEASON_RACE_MONTHS: SeasonMonth[] = [
  { label: "JAN", races: [{ number: "01", name: "Meia da Chapada", date: "31/01", location: "Chapada", distanceKm: 21.1, featured: true }] },
  { label: "MAR", races: [
    { number: "02", name: "Meia de Lisboa", badge: "SuperHalfs", date: "08/03", location: "Lisboa", distanceKm: 21.1, featured: true },
    { number: "03", name: "Meia de Berlim", badge: "SuperHalfs", date: "29/03", location: "Berlim", distanceKm: 21.1, featured: true },
  ] },
  { label: "ABR", races: [{ number: "04", name: "Meia de São Paulo", badge: "27 Capitais", date: "12/04", location: "São Paulo", distanceKm: 21.1, featured: true }] },
  { label: "MAI", races: [
    { number: "05", name: "100% Você 10K", date: "01/05", location: "Brasil", distanceKm: 10, featured: false },
    { number: "06", name: "Circuito Serrano", date: "16/05", location: "Brasil", distanceKm: 5, featured: false },
    { number: "07", name: "Meia de Lima", badge: "MegaFinisher", date: "24/05", location: "Lima", distanceKm: 21.1, featured: true },
  ] },
  { label: "JUN", races: [
    { number: "08", name: "Meia do Rio", badge: "27 Capitais", date: "06/06", location: "Rio de Janeiro", distanceKm: 21.1, featured: true },
    { number: "09", name: "Praia Grande 10K", date: "20/06", location: "Praia Grande", distanceKm: 10, featured: false },
    { number: "10", name: "Praia Grande 5K", date: "21/06", location: "Praia Grande", distanceKm: 5, featured: false },
    { number: "11", name: "Meia de BH", badge: "27 Capitais", date: "28/06", location: "Belo Horizonte", distanceKm: 21.1, featured: true },
  ] },
  { label: "JUL", races: [
    { number: "12", name: "Cats Run", date: "12/07", location: "Brasil", distanceKm: 5, featured: false },
    { number: "13", name: "Asics Run Challenge", date: "26/07", location: "Brasil", distanceKm: 15, featured: true },
  ] },
  { label: "AGO", races: [
    { number: "14", name: "Meia da Chapada", date: "01/08", location: "Chapada", distanceKm: 21.1, featured: true },
    { number: "15", name: "Meia da PF", date: "09/08", location: "Brasília", distanceKm: 21.1, featured: true },
    { number: "16", name: "Track & Field 15K", date: "16/08", location: "Brasília", distanceKm: 15, featured: true },
    { number: "17", name: "Quatro Poderes 10K", date: "22/08", location: "Brasília", distanceKm: 10, featured: false },
    { number: "18", name: "Run The Bridge", date: "30/08", location: "Brasil", distanceKm: 30, fixedStatus: "simulation", featured: true },
  ] },
  { label: "SET", races: [{ number: "19", name: "Buenos Aires", date: "20/09", location: "Argentina", distanceKm: 42, fixedStatus: "mission", featured: true }] },
  { label: "OUT", races: [{ number: "20", name: "Meia de Goiânia", badge: "27 Capitais", date: "18/10", location: "Goiânia", distanceKm: 21.1, featured: true }] },
  { label: "NOV", races: [{ number: "21", name: "Meia de Curitiba", badge: "27 Capitais", date: "15/11", location: "Curitiba", distanceKm: 21.1, featured: true }] },
];

export const MARATHON_CYCLE_RACES: MarathonCycleRace[] = [
  { dateKey: "2026-05-24", name: "Meia de Lima", location: "Lima", distanceKm: 21.1 },
  { dateKey: "2026-06-06", name: "Meia do Rio", location: "Rio de Janeiro", distanceKm: 21.1 },
  { dateKey: "2026-06-20", name: "Praia Grande 10K", location: "Praia Grande", distanceKm: 10 },
  { dateKey: "2026-06-21", name: "Praia Grande 5K", location: "Praia Grande", distanceKm: 5 },
  { dateKey: "2026-06-28", name: "Meia de BH", location: "Belo Horizonte", distanceKm: 21.1 },
  { dateKey: "2026-07-26", name: "Asics Run Challenge", location: "Brasil", distanceKm: 15 },
  { dateKey: "2026-08-01", name: "Meia da Chapada", location: "Chapada", distanceKm: 21.1 },
  { dateKey: "2026-08-09", name: "Meia da PF", location: "Brasília", distanceKm: 21.1 },
  { dateKey: "2026-08-16", name: "Track & Field 15K", location: "Brasília", distanceKm: 15 },
  { dateKey: "2026-08-30", name: "Run The Bridge", location: "Brasil", distanceKm: 30 },
  { dateKey: "2026-09-20", name: "Buenos Aires", location: "Argentina", distanceKm: 42, isGoal: true },
];

import { isRunActivity } from "./strava-client";

export type CapitalStatus = "completed" | "next" | "locked";

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  start_date_local: string;
  average_speed?: number;
  average_heartrate?: number | null;
  total_elevation_gain?: number;
  start_latlng?: [number, number] | [] | null;
  workout_type?: number | null;
};


export type CapitalMedalSymbol =
  | "palacio-rio-branco"
  | "farol-ponta-verde"
  | "marco-zero"
  | "teatro-amazonas"
  | "elevador-lacerda"
  | "ponte-ingleses"
  | "congresso-nacional"
  | "convento-penha"
  | "tres-racas"
  | "palacio-leoes"
  | "arena-pantanal"
  | "obelisco"
  | "pampulha"
  | "ver-o-peso"
  | "farol-cabo-branco"
  | "jardim-botanico"
  | "ponte-nassau"
  | "ponte-estaiada"
  | "cristo-redentor"
  | "forte-reis-magos"
  | "gasometro"
  | "caixas-agua"
  | "portal-milenio"
  | "ponte-hercilio-luz"
  | "masp"
  | "arcos-orla"
  | "palacio-araguaia";

export type CapitalMedalMeta = {
  code: string;
  motif: string;
  symbol: CapitalMedalSymbol;
};

export type CapitalBase = {
  city: string;
  state: string;
  region: string;
  lat: number;
  lng: number;
};

export type CapitalChallengeItem = CapitalBase & {
  status: CapitalStatus;
  bestActivity?: StravaActivity;
  otherHalfMarathons: StravaActivity[];
};

export const capitals: CapitalBase[] = [
  { city: "Rio Branco", state: "AC", region: "Norte", lat: -9.974, lng: -67.824 },
  { city: "Maceió", state: "AL", region: "Nordeste", lat: -9.665, lng: -35.735 },
  { city: "Macapá", state: "AP", region: "Norte", lat: 0.035, lng: -51.07 },
  { city: "Manaus", state: "AM", region: "Norte", lat: -3.119, lng: -60.021 },
  { city: "Salvador", state: "BA", region: "Nordeste", lat: -12.977, lng: -38.501 },
  { city: "Fortaleza", state: "CE", region: "Nordeste", lat: -3.732, lng: -38.527 },
  { city: "Brasília", state: "DF", region: "Centro-Oeste", lat: -15.793, lng: -47.882 },
  { city: "Vitória", state: "ES", region: "Sudeste", lat: -20.319, lng: -40.337 },
  { city: "Goiânia", state: "GO", region: "Centro-Oeste", lat: -16.686, lng: -49.264 },
  { city: "São Luís", state: "MA", region: "Nordeste", lat: -2.53, lng: -44.306 },
  { city: "Cuiabá", state: "MT", region: "Centro-Oeste", lat: -15.601, lng: -56.097 },
  { city: "Campo Grande", state: "MS", region: "Centro-Oeste", lat: -20.469, lng: -54.62 },
  { city: "Belo Horizonte", state: "MG", region: "Sudeste", lat: -19.916, lng: -43.934 },
  { city: "Belém", state: "PA", region: "Norte", lat: -1.455, lng: -48.49 },
  { city: "João Pessoa", state: "PB", region: "Nordeste", lat: -7.119, lng: -34.845 },
  { city: "Curitiba", state: "PR", region: "Sul", lat: -25.428, lng: -49.273 },
  { city: "Recife", state: "PE", region: "Nordeste", lat: -8.047, lng: -34.877 },
  { city: "Teresina", state: "PI", region: "Nordeste", lat: -5.092, lng: -42.803 },
  { city: "Rio de Janeiro", state: "RJ", region: "Sudeste", lat: -22.906, lng: -43.172 },
  { city: "Natal", state: "RN", region: "Nordeste", lat: -5.794, lng: -35.212 },
  { city: "Porto Alegre", state: "RS", region: "Sul", lat: -30.034, lng: -51.217 },
  { city: "Porto Velho", state: "RO", region: "Norte", lat: -8.761, lng: -63.903 },
  { city: "Boa Vista", state: "RR", region: "Norte", lat: 2.823, lng: -60.675 },
  { city: "Florianópolis", state: "SC", region: "Sul", lat: -27.595, lng: -48.548 },
  { city: "São Paulo", state: "SP", region: "Sudeste", lat: -23.55, lng: -46.633 },
  { city: "Aracaju", state: "SE", region: "Nordeste", lat: -10.947, lng: -37.073 },
  { city: "Palmas", state: "TO", region: "Norte", lat: -10.184, lng: -48.334 },
];

export const nextTargetStates = ["GO", "MG", "PR"];

const RACE_KEYWORDS = [
  "meia",
  "21k",
  "21 k",
  "21km",
  "21 km",
  "half",
  "maratona",
  "prova",
  "race",
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isHalfMarathon(activity: StravaActivity) {
  const km = activity.distance / 1000;
  return isRunActivity(activity) && km >= 20.5 && km <= 22.7;
}

export function looksLikeRaceOrHalf(activity: StravaActivity) {
  const normalizedName = normalizeText(activity.name ?? "");
  const hasRaceKeyword = RACE_KEYWORDS.some((keyword) => normalizedName.includes(keyword));

  // workout_type === 1 costuma indicar Race no Strava, quando esse campo vem preenchido.
  return activity.workout_type === 1 || hasRaceKeyword;
}

export function isNearCapital(activity: StravaActivity, capital: CapitalBase) {
  if (!activity.start_latlng?.length) return false;

  const [lat, lng] = activity.start_latlng;
  const distanceFromCapital = distanceKm(lat, lng, capital.lat, capital.lng);

  return distanceFromCapital <= 35;
}

export function formatDateBR(value?: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(seconds?: number) {
  if (!seconds && seconds !== 0) return "—";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(distanceMeters?: number) {
  if (!distanceMeters && distanceMeters !== 0) return "—";

  return `${(distanceMeters / 1000).toFixed(2).replace(".", ",")} km`;
}

export function formatPace(distanceMeters?: number, seconds?: number) {
  if (!distanceMeters || !seconds) return "—";

  const pace = seconds / (distanceMeters / 1000);
  const min = Math.floor(pace / 60);
  const sec = Math.round(pace % 60);

  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

export function buildCapitalChallenge(activities: StravaActivity[]) {
  const halfMarathons = activities.filter(isHalfMarathon);
  const raceLikeHalfMarathons = halfMarathons.filter(looksLikeRaceOrHalf);
  const sourceActivities = raceLikeHalfMarathons.length > 0 ? raceLikeHalfMarathons : halfMarathons;

  return capitals.map<CapitalChallengeItem>((capital) => {
    const capitalHalves = sourceActivities
      .filter((activity) => isNearCapital(activity, capital))
      .sort((a, b) => a.moving_time - b.moving_time);

    const bestActivity = capitalHalves[0];
    const otherHalfMarathons = capitalHalves.slice(1);

    const status: CapitalStatus = bestActivity
      ? "completed"
      : nextTargetStates.includes(capital.state)
        ? "next"
        : "locked";

    return {
      ...capital,
      status,
      bestActivity,
      otherHalfMarathons,
    };
  });
}

export function getStatusLabel(status: CapitalStatus) {
  if (status === "completed") return "Concluída";
  if (status === "next") return "Próxima";
  return "Pendente";
}


export const capitalMedalMetaByState: Record<string, CapitalMedalMeta> = {
  AC: { code: "RBR", motif: "Palácio Rio Branco", symbol: "palacio-rio-branco" },
  AL: { code: "MCZ", motif: "Farol da Ponta Verde", symbol: "farol-ponta-verde" },
  AP: { code: "MCP", motif: "Marco Zero", symbol: "marco-zero" },
  AM: { code: "MAO", motif: "Teatro Amazonas", symbol: "teatro-amazonas" },
  BA: { code: "SSA", motif: "Elevador Lacerda", symbol: "elevador-lacerda" },
  CE: { code: "FOR", motif: "Ponte dos Ingleses", symbol: "ponte-ingleses" },
  DF: { code: "BSB", motif: "Congresso Nacional", symbol: "congresso-nacional" },
  ES: { code: "VIX", motif: "Convento da Penha", symbol: "convento-penha" },
  GO: { code: "GYN", motif: "Monumento às Três Raças", symbol: "tres-racas" },
  MA: { code: "SLZ", motif: "Palácio dos Leões", symbol: "palacio-leoes" },
  MT: { code: "CGB", motif: "Arena Pantanal", symbol: "arena-pantanal" },
  MS: { code: "CGR", motif: "Obelisco", symbol: "obelisco" },
  MG: { code: "BHZ", motif: "Igreja da Pampulha", symbol: "pampulha" },
  PA: { code: "BEL", motif: "Ver-o-Peso", symbol: "ver-o-peso" },
  PB: { code: "JPA", motif: "Farol do Cabo Branco", symbol: "farol-cabo-branco" },
  PR: { code: "CWB", motif: "Jardim Botânico", symbol: "jardim-botanico" },
  PE: { code: "REC", motif: "Ponte Maurício de Nassau", symbol: "ponte-nassau" },
  PI: { code: "THE", motif: "Ponte Estaiada", symbol: "ponte-estaiada" },
  RJ: { code: "RIO", motif: "Cristo Redentor", symbol: "cristo-redentor" },
  RN: { code: "NAT", motif: "Forte dos Reis Magos", symbol: "forte-reis-magos" },
  RS: { code: "POA", motif: "Usina do Gasômetro", symbol: "gasometro" },
  RO: { code: "PVH", motif: "Três Caixas d'Água", symbol: "caixas-agua" },
  RR: { code: "BVB", motif: "Portal do Milênio", symbol: "portal-milenio" },
  SC: { code: "FLN", motif: "Ponte Hercílio Luz", symbol: "ponte-hercilio-luz" },
  SP: { code: "SPO", motif: "MASP", symbol: "masp" },
  SE: { code: "AJU", motif: "Arcos da Orla", symbol: "arcos-orla" },
  TO: { code: "PMW", motif: "Palácio Araguaia", symbol: "palacio-araguaia" },
};

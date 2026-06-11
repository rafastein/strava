import { getValidStravaAccessToken } from "./strava-auth";
import { isRunActivity } from "./strava-activity";
export { isRunActivity, STRAVA_RUN_SPORT_TYPES } from "./strava-activity";

export const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";
export const STRAVA_DEFAULT_PER_PAGE = 200;
export const STRAVA_DEFAULT_MAX_PAGES = 20;
export const STRAVA_2024_START_EPOCH = Math.floor(
  new Date("2024-01-01T00:00:00Z").getTime() / 1000,
);

export type StravaActivityType = "Run" | "TrailRun" | "VirtualRun" | string;

export type StravaLatLng = [number, number] | [] | null;

export type StravaActivitySummary = {
  id: number;
  name: string;
  type: StravaActivityType;
  sport_type?: StravaActivityType;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  start_date: string;
  start_date_local: string;
  timezone?: string;
  start_latlng?: StravaLatLng;
  end_latlng?: StravaLatLng;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  gear_id?: string | null;
};

export type StravaAthlete = {
  id: number;
  firstname: string;
  lastname: string;
  city: string | null;
  state: string | null;
  country?: string | null;
  profile_medium: string | null;
  profile?: string | null;
  shoes?: StravaGear[];
};

export type StravaGear = {
  id: string;
  primary?: boolean;
  name: string;
  resource_state?: number;
  distance?: number;
  brand_name?: string;
  model_name?: string;
  frame_type?: number;
  description?: string | null;
};

export type StravaSplit = {
  distance: number;
  moving_time: number;
  split: number;
  average_heartrate?: number | null;
};

export type StravaLap = {
  id?: number;
  name?: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  split?: number;
  average_speed?: number;
  average_heartrate?: number | null;
};

export type StravaPhoto = {
  id?: number | string;
  unique_id?: string;
  urls?: Record<string, string>;
  source?: number;
};

export type StravaZoneRange = { min: number; max: number; time?: number };

export type StravaZones = {
  heart_rate?: { zones?: StravaZoneRange[] };
  pace?: { zones?: StravaZoneRange[] };
};

export type StravaStream = {
  data?: number[];
  series_type?: string;
  original_size?: number;
  resolution?: string;
};

export type StravaStreams = Record<string, StravaStream | undefined>;

type FetchOptions = {
  accessToken?: string | null;
  cache?: RequestCache;
};

type ActivitiesParams = {
  after?: number;
  before?: number;
  perPage?: number;
  maxPages?: number;
  accessToken?: string | null;
};

async function resolveAccessToken(accessToken?: string | null) {
  if (accessToken) return accessToken;
  return getValidStravaAccessToken();
}


export async function fetchStravaApi<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  try {
    const token = await resolveAccessToken(options.accessToken);
    if (!token) return null;

    const url = path.startsWith("http") ? path : `${STRAVA_API_BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: options.cache ?? "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getStravaAthlete(accessToken?: string | null) {
  return fetchStravaApi<StravaAthlete>("/athlete", { accessToken });
}

export async function getStravaActivities({
  after,
  before,
  perPage = STRAVA_DEFAULT_PER_PAGE,
  maxPages = STRAVA_DEFAULT_MAX_PAGES,
  accessToken,
}: ActivitiesParams = {}): Promise<StravaActivitySummary[]> {
  const token = await resolveAccessToken(accessToken);
  if (!token) return [];

  const allActivities: StravaActivitySummary[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${STRAVA_API_BASE_URL}/athlete/activities`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    if (after) url.searchParams.set("after", String(after));
    if (before) url.searchParams.set("before", String(before));

    const batch = await fetchStravaApi<StravaActivitySummary[]>(url.toString(), {
      accessToken: token,
    });

    if (!Array.isArray(batch) || batch.length === 0) break;

    allActivities.push(...batch);
    if (batch.length < perPage) break;
  }

  return allActivities;
}

export async function getStravaRunActivities(params: ActivitiesParams = {}) {
  const activities = await getStravaActivities(params);
  return activities.filter(isRunActivity);
}

export async function getStravaActivityDetail(
  activityId: number,
  accessToken?: string | null,
) {
  return fetchStravaApi<StravaActivitySummary & { splits_metric?: StravaSplit[] }>(
    `/activities/${activityId}`,
    { accessToken },
  );
}

export async function getStravaActivitySplits(
  activityId: number,
  accessToken?: string | null,
): Promise<StravaSplit[]> {
  const activity = await getStravaActivityDetail(activityId, accessToken);
  return activity?.splits_metric ?? [];
}

export async function getStravaActivityLaps(
  activityId: number,
  accessToken?: string | null,
): Promise<StravaLap[]> {
  const laps = await fetchStravaApi<StravaLap[]>(`/activities/${activityId}/laps`, {
    accessToken,
  });
  return Array.isArray(laps) ? laps : [];
}

export async function getStravaActivityPhotos(
  activityId: number,
  size = 1000,
  accessToken?: string | null,
): Promise<StravaPhoto[]> {
  const photos = await fetchStravaApi<StravaPhoto[]>(
    `/activities/${activityId}/photos?size=${size}`,
    { accessToken },
  );
  return Array.isArray(photos) ? photos : [];
}

export async function getStravaActivityStreams(
  activityId: number,
  keys: string[],
  accessToken?: string | null,
  resolution = "medium",
): Promise<StravaStreams | null> {
  const query = new URLSearchParams({
    keys: keys.join(","),
    key_by_type: "true",
    resolution,
  });

  return fetchStravaApi<StravaStreams>(
    `/activities/${activityId}/streams?${query.toString()}`,
    { accessToken },
  );
}

export async function getStravaAthleteZones(accessToken?: string | null) {
  return fetchStravaApi<StravaZones>("/athlete/zones", { accessToken });
}

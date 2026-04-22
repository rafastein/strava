import fs from "fs/promises";
import path from "path";

type StoredStravaToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  athlete?: {
    id: number;
    firstname?: string;
    lastname?: string;
  };
};

const TOKEN_FILE = path.join(process.cwd(), "data", "strava-token.json");
const isProduction = process.env.NODE_ENV === "production";

let memoryToken: StoredStravaToken | null = null;

async function ensureDataDir() {
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true });
}

function getClientId() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRAVA_CLIENT_ID não encontrado.");
  }
  return clientId;
}

function getClientSecret() {
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("STRAVA_CLIENT_SECRET não encontrado.");
  }
  return clientSecret;
}

function getEnvRefreshToken() {
  return process.env.STRAVA_REFRESH_TOKEN ?? null;
}

function getBaseUrl() {
  return (
    process.env.STRAVA_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

function isTokenExpiringSoon(expiresAt: number, bufferSeconds = 1800) {
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - now <= bufferSeconds;
}

export async function readStoredStravaToken(): Promise<StoredStravaToken | null> {
  if (memoryToken) return memoryToken;

  if (isProduction) {
    return null;
  }

  try {
    const content = await fs.readFile(TOKEN_FILE, "utf-8");
    const parsed = JSON.parse(content) as StoredStravaToken;
    memoryToken = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeStoredStravaToken(token: StoredStravaToken) {
  memoryToken = token;

  if (isProduction) {
    return;
  }

  await ensureDataDir();
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), "utf-8");
}

export async function exchangeCodeForToken(code: string) {
  const client_id = getClientId();
  const client_secret = getClientSecret();

  const body = new URLSearchParams({
    client_id,
    client_secret,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao trocar code por token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as StoredStravaToken;
  await writeStoredStravaToken(data);
  return data;
}

export async function refreshStravaToken(refreshToken: string) {
  const client_id = getClientId();
  const client_secret = getClientSecret();

  const body = new URLSearchParams({
    client_id,
    client_secret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao renovar token do Strava: ${res.status} ${text}`);
  }

  const data = (await res.json()) as StoredStravaToken;
  await writeStoredStravaToken(data);
  return data;
}

export async function getValidStravaAccessToken() {
  const stored = await readStoredStravaToken();
  const envRefreshToken = getEnvRefreshToken();

  if (stored?.access_token && stored?.refresh_token) {
    if (isTokenExpiringSoon(stored.expires_at)) {
      const refreshed = await refreshStravaToken(stored.refresh_token);
      return refreshed.access_token;
    }

    return stored.access_token;
  }

  if (envRefreshToken) {
    const refreshed = await refreshStravaToken(envRefreshToken);
    return refreshed.access_token;
  }

  return null;
}

export async function getStravaAuthorizeUrl() {
  const clientId = getClientId();
  const redirectUri = `${getBaseUrl()}/api/auth/strava/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "force",
    scope: "read,activity:read_all",
  });

  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}
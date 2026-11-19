import { createHash, randomBytes } from "node:crypto";
import { getRedisClient } from "./redis-client";

// Login no MCP do COROS: OAuth 2.1 com registro dinâmico do app e PKCE.
// O site se cadastra sozinho no servidor de autorização do COROS, você autoriza uma vez,
// e o refresh token (offline_access) fica no Redis para as sincronizações seguintes.

export const COROS_MCP_URL = process.env.COROS_MCP_URL || "https://mcp.coros.com/mcp";
const COROS_SCOPES = "openid mcp.tools offline_access";
const OAUTH_KEY = "coros:oauth";

type FetchLike = typeof fetch;

export type CorosAuthServer = {
  /** Recurso protegido, como o COROS anuncia (vai no parâmetro `resource`). */
  resource: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  revocationEndpoint?: string;
};

export type CorosClient = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
};

export type CorosTokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch em segundos. */
  expiresAt: number;
  scope?: string;
};

export type CorosOAuthState = {
  server?: CorosAuthServer;
  client?: CorosClient;
  tokens?: CorosTokens;
  connectedAt?: string;
};

// ── Armazenamento ──

export type CorosOAuthStore = {
  read(): Promise<CorosOAuthState>;
  write(state: CorosOAuthState): Promise<void>;
};

export const redisCorosOAuthStore: CorosOAuthStore = {
  async read() {
    const redis = await getRedisClient();
    if (!redis) return {};
    const raw = await redis.get(OAUTH_KEY);
    if (!raw) return {};
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as CorosOAuthState;
  },
  async write(state) {
    const redis = await getRedisClient();
    if (!redis) throw new Error("Redis não configurado: a conexão com o COROS precisa do Upstash.");
    await redis.set(OAUTH_KEY, JSON.stringify(state));
  },
};

// ── Descoberta ──

async function getJson(fetchImpl: FetchLike, url: string, init?: RequestInit) {
  const res = await fetchImpl(url, { ...init, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`COROS respondeu ${res.status} em ${new URL(url).pathname}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta inesperada do COROS em ${new URL(url).pathname}.`);
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) throw new Error(`Metadados do COROS sem o campo ${field}.`);
  return value;
}

export async function discoverCorosAuthServer(fetchImpl: FetchLike = fetch): Promise<CorosAuthServer> {
  const mcpOrigin = new URL(COROS_MCP_URL).origin;
  const resourceMeta = await getJson(fetchImpl, `${mcpOrigin}/.well-known/oauth-protected-resource`);
  const servers = resourceMeta.authorization_servers;
  const issuer = Array.isArray(servers) && typeof servers[0] === "string" ? servers[0] : mcpOrigin;
  const asMeta = await getJson(fetchImpl, `${issuer.replace(/\/$/, "")}/.well-known/oauth-authorization-server`);

  const methods = asMeta.code_challenge_methods_supported;
  if (Array.isArray(methods) && !methods.includes("S256")) {
    throw new Error("O servidor do COROS não aceita PKCE S256.");
  }

  return {
    resource: typeof resourceMeta.resource === "string" ? resourceMeta.resource : mcpOrigin,
    issuer: requireString(asMeta.issuer, "issuer"),
    authorizationEndpoint: requireString(asMeta.authorization_endpoint, "authorization_endpoint"),
    tokenEndpoint: requireString(asMeta.token_endpoint, "token_endpoint"),
    registrationEndpoint: requireString(asMeta.registration_endpoint, "registration_endpoint"),
    revocationEndpoint: typeof asMeta.revocation_endpoint === "string" ? asMeta.revocation_endpoint : undefined,
  };
}

// ── Registro do app ──

export async function registerCorosClient(
  server: CorosAuthServer,
  redirectUri: string,
  fetchImpl: FetchLike = fetch,
): Promise<CorosClient> {
  const body = await getJson(fetchImpl, server.registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Strava do Rafa",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: COROS_SCOPES,
    }),
  });

  return {
    clientId: requireString(body.client_id, "client_id"),
    clientSecret: typeof body.client_secret === "string" ? body.client_secret : undefined,
    redirectUri,
  };
}

// ── PKCE ──

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// ── Início do login ──

export async function startCorosAuthorization(
  redirectUri: string,
  { store = redisCorosOAuthStore, fetchImpl = fetch }: { store?: CorosOAuthStore; fetchImpl?: FetchLike } = {},
) {
  if (store === redisCorosOAuthStore && !(await getRedisClient())) {
    throw new Error("Redis não configurado: a conexão com o COROS precisa do Upstash.");
  }
  const state = await store.read();
  const server = await discoverCorosAuthServer(fetchImpl);
  // Registro novo quando muda o servidor ou o endereço de retorno (outro domínio, localhost).
  const client =
    state.client && state.client.redirectUri === redirectUri && state.server?.issuer === server.issuer
      ? state.client
      : await registerCorosClient(server, redirectUri, fetchImpl);

  await store.write({ ...state, server, client });

  const pkce = createPkcePair();
  const oauthState = base64Url(randomBytes(16));
  const url = new URL(server.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", COROS_SCOPES);
  url.searchParams.set("state", oauthState);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", server.resource);

  return { url: url.toString(), state: oauthState, verifier: pkce.verifier };
}

// ── Tokens ──

function parseTokenResponse(body: Record<string, unknown>, previousRefresh: string | null): CorosTokens {
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : Number(body.expires_in) || 3600;
  return {
    accessToken: requireString(body.access_token, "access_token"),
    // Alguns servidores só devolvem refresh token novo quando ele gira.
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : previousRefresh,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    scope: typeof body.scope === "string" ? body.scope : undefined,
  };
}

function tokenRequestBody(client: CorosClient, server: CorosAuthServer, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, client_id: client.clientId, resource: server.resource });
  if (client.clientSecret) body.set("client_secret", client.clientSecret);
  return body;
}

export async function finishCorosAuthorization(
  code: string,
  verifier: string,
  { store = redisCorosOAuthStore, fetchImpl = fetch }: { store?: CorosOAuthStore; fetchImpl?: FetchLike } = {},
) {
  const state = await store.read();
  if (!state.server || !state.client) throw new Error("Login do COROS não foi iniciado por este site.");

  const body = await getJson(fetchImpl, state.server.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: tokenRequestBody(state.client, state.server, {
      grant_type: "authorization_code",
      code,
      redirect_uri: state.client.redirectUri,
      code_verifier: verifier,
    }),
  });

  const tokens = parseTokenResponse(body, null);
  await store.write({ ...state, tokens, connectedAt: new Date().toISOString() });
  return tokens;
}

export async function refreshCorosTokens(
  { store = redisCorosOAuthStore, fetchImpl = fetch }: { store?: CorosOAuthStore; fetchImpl?: FetchLike } = {},
) {
  const state = await store.read();
  if (!state.server || !state.client || !state.tokens?.refreshToken) {
    throw new Error("COROS não conectado: conecte de novo na página do COROS.");
  }

  const body = await getJson(fetchImpl, state.server.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: tokenRequestBody(state.client, state.server, {
      grant_type: "refresh_token",
      refresh_token: state.tokens.refreshToken,
    }),
  });

  const tokens = parseTokenResponse(body, state.tokens.refreshToken);
  await store.write({ ...state, tokens });
  return tokens;
}

/** Access token válido por pelo menos mais um minuto; renova quando preciso. */
export async function getCorosAccessToken(
  options: { store?: CorosOAuthStore; fetchImpl?: FetchLike; forceRefresh?: boolean } = {},
) {
  const store = options.store ?? redisCorosOAuthStore;
  const state = await store.read();
  if (!state.tokens) return null;

  const expiring = state.tokens.expiresAt - Math.floor(Date.now() / 1000) < 60;
  if (!expiring && !options.forceRefresh) return state.tokens.accessToken;
  return (await refreshCorosTokens({ store, fetchImpl: options.fetchImpl })).accessToken;
}

export async function disconnectCoros(
  { store = redisCorosOAuthStore, fetchImpl = fetch }: { store?: CorosOAuthStore; fetchImpl?: FetchLike } = {},
) {
  const state = await store.read();
  const token = state.tokens?.refreshToken ?? state.tokens?.accessToken;
  if (state.server?.revocationEndpoint && state.client && token) {
    // Revogar é cortesia: se falhar, o token some do site do mesmo jeito.
    await fetchImpl(state.server.revocationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, client_id: state.client.clientId }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await store.write({ server: state.server, client: state.client });
}

export async function getCorosConnectionInfo(store: CorosOAuthStore = redisCorosOAuthStore) {
  try {
    const state = await store.read();
    return {
      connected: Boolean(state.tokens?.refreshToken || state.tokens?.accessToken),
      connectedAt: state.connectedAt ?? null,
    };
  } catch {
    return { connected: false, connectedAt: null };
  }
}

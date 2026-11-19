import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createPkcePair,
  finishCorosAuthorization,
  getCorosAccessToken,
  startCorosAuthorization,
  type CorosOAuthState,
  type CorosOAuthStore,
} from "../app/lib/coros-oauth";

function memoryStore(initial: CorosOAuthState = {}): CorosOAuthStore & { state: CorosOAuthState } {
  const store = {
    state: initial,
    async read() {
      return structuredClone(store.state);
    },
    async write(next: CorosOAuthState) {
      store.state = structuredClone(next);
    },
  };
  return store;
}

type Call = { url: string; method: string; body: string };

// Servidor COROS simulado, com os mesmos metadados publicados em mcp.coros.com.
function fakeCoros() {
  const calls: Call[] = [];
  let tokenCount = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : "";
    calls.push({ url, method: init?.method ?? "GET", body });
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

    if (url === "https://mcp.coros.com/.well-known/oauth-protected-resource") {
      return json({ resource: "https://mcpus.coros.com", authorization_servers: ["https://mcpus.coros.com"] });
    }
    if (url === "https://mcpus.coros.com/.well-known/oauth-authorization-server") {
      return json({
        issuer: "https://mcpus.coros.com",
        authorization_endpoint: "https://mcpus.coros.com/oauth2/authorize",
        token_endpoint: "https://mcpus.coros.com/oauth2/token",
        registration_endpoint: "https://mcpus.coros.com/connect/register",
        revocation_endpoint: "https://mcpus.coros.com/oauth2/revoke",
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (url === "https://mcpus.coros.com/connect/register") return json({ client_id: "cli-123" });
    if (url === "https://mcpus.coros.com/oauth2/token") {
      tokenCount += 1;
      return json({ access_token: `at-${tokenCount}`, refresh_token: `rt-${tokenCount}`, expires_in: 3600 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test("PKCE: o desafio é o SHA-256 do verificador em base64url", () => {
  const { verifier, challenge } = createPkcePair();
  const expected = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(challenge, expected);
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
});

test("login completo: registro do app, URL de autorização e troca do código", async () => {
  const store = memoryStore();
  const { fetchImpl, calls } = fakeCoros();
  const redirect = "https://stravadorafa.vercel.app/api/auth/coros/callback";

  const start = await startCorosAuthorization(redirect, { store, fetchImpl });
  const url = new URL(start.url);
  assert.equal(url.origin + url.pathname, "https://mcpus.coros.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "cli-123");
  assert.equal(url.searchParams.get("redirect_uri"), redirect);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), start.state);
  assert.equal(url.searchParams.get("resource"), "https://mcpus.coros.com");
  assert.match(url.searchParams.get("scope") ?? "", /offline_access/);

  const register = calls.find((call) => call.url.endsWith("/connect/register"));
  assert.deepEqual(JSON.parse(register?.body ?? "{}").redirect_uris, [redirect]);

  await finishCorosAuthorization("code-abc", start.verifier, { store, fetchImpl });
  const tokenCall = new URLSearchParams(calls.at(-1)?.body);
  assert.equal(tokenCall.get("grant_type"), "authorization_code");
  assert.equal(tokenCall.get("code_verifier"), start.verifier);
  assert.equal(store.state.tokens?.accessToken, "at-1");
  assert.equal(store.state.tokens?.refreshToken, "rt-1");

  // Segundo login com o mesmo endereço reaproveita o app já registrado.
  await startCorosAuthorization(redirect, { store, fetchImpl });
  assert.equal(calls.filter((call) => call.url.endsWith("/connect/register")).length, 1);
});

test("token perto de vencer é renovado com o refresh token", async () => {
  const { fetchImpl, calls } = fakeCoros();
  const base: CorosOAuthState = {
    server: {
      resource: "https://mcpus.coros.com",
      issuer: "https://mcpus.coros.com",
      authorizationEndpoint: "https://mcpus.coros.com/oauth2/authorize",
      tokenEndpoint: "https://mcpus.coros.com/oauth2/token",
      registrationEndpoint: "https://mcpus.coros.com/connect/register",
    },
    client: { clientId: "cli-123", redirectUri: "https://x/api/auth/coros/callback" },
  };

  const fresh = memoryStore({ ...base, tokens: { accessToken: "ok", refreshToken: "rt-0", expiresAt: Date.now() / 1000 + 3600 } });
  assert.equal(await getCorosAccessToken({ store: fresh, fetchImpl }), "ok");
  assert.equal(calls.length, 0);

  const expiring = memoryStore({ ...base, tokens: { accessToken: "old", refreshToken: "rt-0", expiresAt: Date.now() / 1000 + 10 } });
  assert.equal(await getCorosAccessToken({ store: expiring, fetchImpl }), "at-1");
  assert.equal(new URLSearchParams(calls[0].body).get("refresh_token"), "rt-0");
  assert.equal(expiring.state.tokens?.refreshToken, "rt-1");

  assert.equal(await getCorosAccessToken({ store: memoryStore(base), fetchImpl }), null);
});

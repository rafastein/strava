import test from "node:test";
import assert from "node:assert/strict";

import { isAdminRequest } from "../app/lib/admin-auth";
import { hitMemoryWindow, parseActivityId } from "../app/lib/rate-limit";

const env = process.env as Record<string, string | undefined>;

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const keys = ["ADMIN_SECRET", "REVALIDATE_SECRET", "SITE_ADMIN_SECRET", "NODE_ENV"];
  const saved = Object.fromEntries(keys.map((key) => [key, env[key]]));
  for (const key of keys) delete env[key];
  Object.assign(env, values);
  try {
    run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

const request = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

test("admin sem segredo: aberto em desenvolvimento, fechado em produção", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    assert.equal(isAdminRequest(request("https://site.test/api/races")), true);
  });
  withEnv({ NODE_ENV: "production" }, () => {
    assert.equal(isAdminRequest(request("https://site.test/api/races")), false);
  });
});

test("admin aceita o segredo só em cabeçalho", () => {
  withEnv({ NODE_ENV: "production", ADMIN_SECRET: "s3gredo" }, () => {
    assert.equal(isAdminRequest(request("https://site.test/api/races", { "x-admin-secret": "s3gredo" })), true);
    assert.equal(isAdminRequest(request("https://site.test/api/races", { authorization: "Bearer s3gredo" })), true);
    assert.equal(isAdminRequest(request("https://site.test/api/races", { "x-admin-secret": "errado" })), false);
    assert.equal(isAdminRequest(request("https://site.test/api/races")), false);
    // Segredo na URL não vale mais.
    assert.equal(isAdminRequest(request("https://site.test/api/races?secret=s3gredo")), false);
    assert.equal(isAdminRequest(request("https://site.test/api/races?adminSecret=s3gredo")), false);
  });
});

test("contador de janela fixa reinicia a cada janela", () => {
  const store = new Map();
  const start = 60_000 * 1000;
  assert.equal(hitMemoryWindow(store, "a", 60, start), 1);
  assert.equal(hitMemoryWindow(store, "a", 60, start + 59_000), 2);
  assert.equal(hitMemoryWindow(store, "b", 60, start + 59_000), 1);
  assert.equal(hitMemoryWindow(store, "a", 60, start + 60_000), 1);
});

test("id de atividade só aceita inteiro positivo", () => {
  assert.equal(parseActivityId("16234567890"), 16234567890);
  for (const bad of [null, "", "0", "-5", "12.5", "1e9", "abc", "12 OR 1=1", "1234567890123456"]) {
    assert.equal(parseActivityId(bad), null);
  }
});

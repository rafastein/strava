#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "true");
  }
}

const file = args.get("file") ?? "data/coros-training-schedule-2026-06-11.json";
const baseUrl = (args.get("url") ?? process.env.COROS_IMPORT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminSecret = args.get("secret") ?? process.env.ADMIN_SECRET ?? process.env.SITE_ADMIN_SECRET ?? "";
const dryRun = args.get("dry-run") === "true";

if (!adminSecret) {
  console.error("Defina ADMIN_SECRET ou passe --secret para importar a agenda COROS.");
  process.exit(1);
}

const absoluteFile = path.resolve(process.cwd(), file);
const payload = JSON.parse(await fs.readFile(absoluteFile, "utf8"));

const response = await fetch(`${baseUrl}/api/coros/import-schedule`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-admin-secret": adminSecret,
  },
  body: JSON.stringify({ ...payload, dryRun }),
});

const text = await response.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text };
}

if (!response.ok) {
  console.error("Falha na importação COROS:", body);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));

import { NextResponse } from "next/server";

const ADMIN_HEADER = "x-admin-secret";

function getConfiguredSecret() {
  return (
    process.env.ADMIN_SECRET ??
    process.env.REVALIDATE_SECRET ??
    process.env.SITE_ADMIN_SECRET ??
    ""
  ).trim();
}

function getProvidedSecret(req: Request) {
  const url = new URL(req.url);
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return (
    req.headers.get(ADMIN_HEADER)?.trim() ||
    bearer ||
    url.searchParams.get("adminSecret")?.trim() ||
    url.searchParams.get("secret")?.trim() ||
    ""
  );
}

export function isAdminRequest(req: Request) {
  const configuredSecret = getConfiguredSecret();

  // Sem segredo configurado: mantém o fluxo local funcionando.
  // Em produção, defina ADMIN_SECRET para proteger rotas de escrita/debug.
  if (!configuredSecret) return true;

  return getProvidedSecret(req) === configuredSecret;
}

export function requireAdminRequest(req: Request) {
  if (isAdminRequest(req)) return null;

  return NextResponse.json(
    { error: "Acesso administrativo necessário." },
    { status: 401 }
  );
}

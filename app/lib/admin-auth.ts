import { createHash, timingSafeEqual } from "node:crypto";
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
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return (
    req.headers.get(ADMIN_HEADER)?.trim() ||
    bearer ||
    ""
  );
}

/** Compara em tempo constante, sem vazar o tamanho do segredo. */
function safeEqual(a: string, b: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function isAdminRequest(req: Request) {
  const configuredSecret = getConfiguredSecret();

  // Sem segredo configurado: liberado só fora de produção, para o fluxo local funcionar.
  // Em produção as rotas de escrita ficam fechadas até ADMIN_SECRET ser definido.
  if (!configuredSecret) return process.env.NODE_ENV !== "production";

  // O segredo só é aceito em cabeçalho (x-admin-secret ou Authorization: Bearer);
  // na URL ele ficaria em logs e no histórico do navegador.
  const provided = getProvidedSecret(req);
  return provided.length > 0 && safeEqual(provided, configuredSecret);
}

export function requireAdminRequest(req: Request) {
  if (isAdminRequest(req)) return null;

  return NextResponse.json(
    { error: "Acesso administrativo necessário." },
    { status: 401 }
  );
}

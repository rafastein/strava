import type { NextRequest } from "next/server";

export const COROS_OAUTH_COOKIE = "coros_oauth";

/** Endereço de retorno do login; COROS_REDIRECT_URI força um fixo (ex.: domínio próprio). */
export function getCorosRedirectUri(req: NextRequest) {
  return process.env.COROS_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/coros/callback`;
}

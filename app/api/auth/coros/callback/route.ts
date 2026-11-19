import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { finishCorosAuthorization } from "../../../../lib/coros-oauth";
import { runCorosSync } from "../../../../lib/coros-sync";
import { getRaceCalendarTodayKey } from "../../../../lib/race-calendar";
import { COROS_OAUTH_COOKIE } from "../shared";

export const dynamic = "force-dynamic";

function back(req: NextRequest, status: string, detail?: string) {
  const url = new URL("/coros", req.nextUrl.origin);
  url.searchParams.set("coros", status);
  if (detail) url.searchParams.set("detalhe", detail.slice(0, 160));
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: COROS_OAUTH_COOKIE, path: "/api/auth/coros" });
  return res;
}

function sameState(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back(req, "negado", params.get("error_description") ?? params.get("error") ?? undefined);

  const code = params.get("code");
  const state = params.get("state");
  const cookie = req.cookies.get(COROS_OAUTH_COOKIE)?.value ?? "";
  const [expectedState, verifier] = cookie.split(".");

  // O state só confere se o login começou neste navegador, com a senha administrativa.
  if (!code || !state || !expectedState || !verifier || !sameState(state, expectedState)) {
    return back(req, "invalido");
  }

  try {
    await finishCorosAuthorization(code, verifier);
  } catch (error) {
    return back(req, "erro", error instanceof Error ? error.message : undefined);
  }

  // Primeira sincronização logo depois de conectar, sem segurar o redirecionamento.
  after(() => runCorosSync(getRaceCalendarTodayKey(), "conexão").catch(() => undefined));
  return back(req, "conectado");
}

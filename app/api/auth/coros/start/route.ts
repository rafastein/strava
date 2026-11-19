import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "../../../../lib/admin-auth";
import { startCorosAuthorization } from "../../../../lib/coros-oauth";
import { COROS_OAUTH_COOKIE, getCorosRedirectUri } from "../shared";

export const dynamic = "force-dynamic";

// Só quem tem a senha administrativa começa o login: sem isso, qualquer pessoa
// poderia ligar a própria conta COROS ao site.
export async function POST(req: NextRequest) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const { url, state, verifier } = await startCorosAuthorization(getCorosRedirectUri(req));
    const res = NextResponse.json({ url });
    res.cookies.set(COROS_OAUTH_COOKIE, `${state}.${verifier}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/coros",
      maxAge: 600,
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar o login no COROS.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

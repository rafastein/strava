import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "../../../../lib/strava-auth";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.json(
        { error: "Autorização negada pelo Strava.", details: error },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Code não encontrado na URL de callback." },
        { status: 400 }
      );
    }

    const token = await exchangeCodeForToken(code);
    const refreshToken = token.refresh_token;

    return new NextResponse(
      `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Strava autorizado</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #020617;
        color: #e5e7eb;
        font-family: Arial, sans-serif;
      }
      main {
        width: min(760px, calc(100vw - 32px));
        padding: 28px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 24px;
        background: rgba(15, 23, 42, 0.88);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { line-height: 1.55; color: #cbd5e1; }
      textarea {
        width: 100%;
        min-height: 96px;
        box-sizing: border-box;
        margin-top: 12px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: #020617;
        color: #f8fafc;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
      }
      .key {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        color: #86efac;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
      }
      .warning { color: #fbbf24; }
    </style>
  </head>
  <body>
    <main>
      <h1>Strava autorizado com sucesso.</h1>
      <p>Copie o token abaixo e salve no Vercel como <span class="key">STRAVA_REFRESH_TOKEN</span>.</p>
      <textarea readonly>${escapeHtml(refreshToken)}</textarea>
      <p class="warning">Não publique esse token no GitHub, prints ou mensagens públicas.</p>
    </main>
  </body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";

    return NextResponse.json(
      { error: "Erro ao autorizar Strava.", details: message },
      { status: 500 }
    );
  }
}

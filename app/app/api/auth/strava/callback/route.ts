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

function hasRedisConfigured() {
  return !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
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
    const isProduction = process.env.NODE_ENV === "production";
    const redisAvailable = hasRedisConfigured();
    const savedAutomatically = isProduction ? redisAvailable : true; // dev sempre salva em arquivo

    const savedBlock = savedAutomatically
      ? `<div class="status ok">
          <span class="dot"></span>
          Token salvo automaticamente${isProduction ? " no Redis" : " em data/strava-token.json"}.
          Redirecionando para o dashboard em <span id="count">5</span>s…
        </div>`
      : `<div class="status warn">
          <span class="dot"></span>
          Redis não configurado — token <strong>não foi persistido</strong> automaticamente.
          Copie o valor abaixo e salve no Vercel como <code>STRAVA_REFRESH_TOKEN</code>.
        </div>
        <textarea readonly spellcheck="false">${escapeHtml(refreshToken)}</textarea>
        <p class="hint">Não publique esse token no GitHub, prints ou mensagens públicas.</p>`;

    const redirectScript = savedAutomatically
      ? `<script>
          let n = 5;
          const el = document.getElementById("count");
          const t = setInterval(() => { n--; el.textContent = n; if (n <= 0) { clearInterval(t); location.href = "/"; } }, 1000);
        </script>`
      : "";

    return new NextResponse(
      `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Strava autorizado</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
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
        width: min(720px, calc(100vw - 32px));
        padding: 32px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        background: rgba(15, 23, 42, 0.9);
      }
      h1 { margin: 0 0 20px; font-size: 24px; font-weight: 600; }
      .status {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.6;
      }
      .status.ok   { background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); color: #86efac; }
      .status.warn { background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.2); color: #fde68a; }
      .dot {
        flex-shrink: 0;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-top: 5px;
      }
      .ok   .dot { background: #22c55e; }
      .warn .dot { background: #f59e0b; }
      textarea {
        display: block;
        width: 100%;
        min-height: 88px;
        margin-top: 16px;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: #020617;
        color: #f8fafc;
        font-family: ui-monospace, Menlo, monospace;
        font-size: 13px;
        resize: vertical;
      }
      .hint { margin-top: 10px; font-size: 13px; color: #94a3b8; }
      code {
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(148, 163, 184, 0.1);
        font-family: ui-monospace, Menlo, monospace;
        font-size: 12px;
        color: #93c5fd;
      }
      strong { font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Strava autorizado ✓</h1>
      ${savedBlock}
    </main>
    ${redirectScript}
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
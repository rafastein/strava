import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/app/lib/strava-auth";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `Autorização Strava falhou: ${error}` },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "Code de autorização não encontrado." },
      { status: 400 }
    );
  }

  try {
    await exchangeCodeForToken(code);
    return NextResponse.redirect(new URL("/", getBaseUrl(request)));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao autenticar com o Strava.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
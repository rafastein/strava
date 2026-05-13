import { NextRequest, NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../lib/strava-auth";

export const dynamic = "force-dynamic";

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";

function getSafeNumberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function GET(req: NextRequest) {
  try {
    const accessToken = await getValidStravaAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Token do Strava não encontrado. Configure STRAVA_REFRESH_TOKEN no Vercel ou autorize novamente o Strava.",
        },
        { status: 401 }
      );
    }

    const page = getSafeNumberParam(req.nextUrl.searchParams.get("page"), 1, 1, 1000);
    const perPage = getSafeNumberParam(
      req.nextUrl.searchParams.get("per_page"),
      200,
      1,
      200
    );
    const before = req.nextUrl.searchParams.get("before");
    const after = req.nextUrl.searchParams.get("after");

    const url = new URL(STRAVA_ACTIVITIES_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    if (before) {
      url.searchParams.set("before", before);
    }

    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Falha ao buscar atividades no Strava.",
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";

    return NextResponse.json(
      { error: "Erro interno ao buscar atividades do Strava.", details: message },
      { status: 500 }
    );
  }
}

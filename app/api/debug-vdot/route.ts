// app/api/debug-vdot/route.ts
// ROTA TEMPORÁRIA DE DEBUG — remover após resolver o problema
import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../lib/strava-auth";
import { getDynamicAthleteProfile } from "../../lib/strava-prs";

export const dynamic = "force-dynamic";

export async function GET() {
  const accessToken = await getValidStravaAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Sem access token" }, { status: 401 });
  }

  const profile = await getDynamicAthleteProfile(accessToken);

  return NextResponse.json({
    token_preview: accessToken.slice(-6),
    vdot: profile.vdot,
    vo2max: profile.vo2max,
    prs: {
      km5: profile.prs.km5
        ? { timeSec: profile.prs.km5.timeSec, ageMonths: profile.prs.km5.ageMonths, name: profile.prs.km5.name, startDate: profile.prs.km5.startDate }
        : null,
      km10: profile.prs.km10
        ? { timeSec: profile.prs.km10.timeSec, ageMonths: profile.prs.km10.ageMonths, name: profile.prs.km10.name, startDate: profile.prs.km10.startDate }
        : null,
      half: profile.prs.half
        ? { timeSec: profile.prs.half.timeSec, ageMonths: profile.prs.half.ageMonths, name: profile.prs.half.name, startDate: profile.prs.half.startDate }
        : null,
      marathon: profile.prs.marathon
        ? { timeSec: profile.prs.marathon.timeSec, ageMonths: profile.prs.marathon.ageMonths, name: profile.prs.marathon.name, startDate: profile.prs.marathon.startDate }
        : null,
    },
  });
}
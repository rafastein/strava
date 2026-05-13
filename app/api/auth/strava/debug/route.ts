import { NextResponse } from "next/server";
import { getValidStravaAccessToken } from "../../../../lib/strava-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  let accessToken = null;
  let tokenError  = null;
  let athleteData = null;
  let athleteError = null;
  let activitiesCount = null;
  let activitiesError = null;

  try { accessToken = await getValidStravaAccessToken(); }
  catch (e) { tokenError = String(e); }

  if (accessToken) {
    // Test athlete endpoint
    try {
      const res = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const d = await res.json();
        athleteData = { id: d.id, firstname: d.firstname, lastname: d.lastname, status: res.status };
      } else {
        athleteError = `${res.status}: ${await res.text()}`;
      }
    } catch (e) { athleteError = String(e); }

    // Test activities endpoint
    try {
      const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=3", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (res.ok) {
        const d = await res.json();
        activitiesCount = Array.isArray(d) ? d.length : "not array";
      } else {
        activitiesError = `${res.status}: ${await res.text()}`;
      }
    } catch (e) { activitiesError = String(e); }
  }

  return NextResponse.json({
    token: { ok: !!accessToken, error: tokenError },
    athlete: { data: athleteData, error: athleteError },
    activities: { count: activitiesCount, error: activitiesError },
  });
}

import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../../lib/admin-auth";
import { importCorosSchedule } from "../../../lib/coros-planned-workouts";
import { clearQualityWorkoutsSnapshot } from "../../../lib/quality-workouts-cache";

export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const result = await importCorosSchedule(body);
    if (!result.dryRun) await clearQualityWorkoutsSnapshot();

    return NextResponse.json({
      success: true,
      importedCount: result.imported.length,
      dryRun: result.dryRun,
      workouts: result.imported.map(({ key, workout }) => ({
        key,
        date: workout.date,
        title: workout.title,
        type: workout.type,
        distanceKm: workout.distanceKm,
        durationMin: workout.durationMin,
        estimatedTime: workout.estimatedTime ?? null,
        loadTl: workout.loadTl ?? null,
        steps: workout.steps,
        source: workout.source,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar agenda COROS.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../lib/admin-auth";
import {
  deleteStructuredPlannedWorkout,
  getStructuredPlannedWorkout,
  getTodayIsoDate,
  saveStructuredPlannedWorkout,
} from "../../lib/planned-workout";

function getDateFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("date")?.trim() || getTodayIsoDate();
}

export async function GET(req: Request) {
  const date = getDateFromRequest(req);
  const result = await getStructuredPlannedWorkout(date);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const result = await saveStructuredPlannedWorkout(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar treino estruturado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const date = getDateFromRequest(req);
    const result = await deleteStructuredPlannedWorkout(date);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao apagar treino estruturado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

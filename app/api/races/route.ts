import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../lib/admin-auth";
import {
  deleteManagedRace,
  getRaceCalendarData,
  resetManagedRaces,
  saveManagedRaces,
  upsertManagedRace,
} from "../../lib/race-calendar";

export async function GET() {
  const data = await getRaceCalendarData();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();

    if (Array.isArray(body?.races)) {
      const result = await saveManagedRaces(body.races);
      return NextResponse.json({ success: true, ...result });
    }

    const result = await upsertManagedRace(body?.race ?? body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar prova.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const reset = url.searchParams.get("reset") === "true";

    if (reset) {
      const result = await resetManagedRaces();
      return NextResponse.json({ success: true, ...result });
    }

    const id = url.searchParams.get("id")?.trim() ?? "";
    const result = await deleteManagedRace(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao apagar prova.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

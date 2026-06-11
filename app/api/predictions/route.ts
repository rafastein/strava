import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../lib/admin-auth";
import {
  MANUAL_PREDICTIONS_KEY,
  readManualPredictions,
  writeManualPredictions,
} from "../../lib/manual-predictions";

function isValidTime(value: string) {
  return /^\d{2}:\d{2}:\d{2}$/.test(value);
}

export async function GET() {
  const { data, source } = await readManualPredictions();
  return NextResponse.json({ ...data, source, key: MANUAL_PREDICTIONS_KEY });
}

export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();

    const stravaMarathonPrediction =
      typeof body.stravaMarathonPrediction === "string"
        ? body.stravaMarathonPrediction.trim()
        : "";

    if (!isValidTime(stravaMarathonPrediction)) {
      return NextResponse.json(
        { error: "A previsão deve estar no formato HH:MM:SS." },
        { status: 400 }
      );
    }

    const result = await writeManualPredictions({ stravaMarathonPrediction });

    return NextResponse.json({
      success: true,
      data: result.data,
      source: result.source,
      key: MANUAL_PREDICTIONS_KEY,
    });
  } catch (error) {
    console.error("Erro ao salvar previsão manual:", error);
    return NextResponse.json(
      { error: "Falha ao salvar previsão." },
      { status: 500 }
    );
  }
}

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../../lib/admin-auth";
import { runCorosSync } from "../../../lib/coros-sync";
import { getRaceCalendarTodayKey } from "../../../lib/race-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isVercelCron(req: Request) {
  // A Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const provided = req.headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(`Bearer ${secret}`));
}

async function sync(trigger: string) {
  try {
    const status = await runCorosSync(getRaceCalendarTodayKey(), trigger);
    return NextResponse.json(status, { status: status.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar com o COROS.";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

// Cron da Vercel (GET).
export async function GET(req: Request) {
  if (!isVercelCron(req)) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  return sync("cron");
}

// Botão "Sincronizar agora" (POST com a senha administrativa).
export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;
  return sync("manual");
}

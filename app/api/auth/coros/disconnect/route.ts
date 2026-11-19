import { NextResponse } from "next/server";
import { requireAdminRequest } from "../../../../lib/admin-auth";
import { disconnectCoros } from "../../../../lib/coros-oauth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;
  await disconnectCoros();
  return NextResponse.json({ success: true });
}

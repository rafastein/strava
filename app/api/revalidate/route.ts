import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "../../lib/admin-auth";
import { clearQualityWorkoutsSnapshot } from "../../lib/quality-workouts-cache";

const PATHS = [
  "/",
  "/buenos-aires",
  "/coros",
  "/provas",
  "/27-capitais",
  "/equipamentos",
  "/carga",
  "/sisrun",
  "/longoes",
  "/meias",
  "/corridas-brasil",
  "/corridas-mundo",
  "/treinos-qualidade",
];

export async function POST(req: NextRequest) {
  const unauthorized = requireAdminRequest(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (path && PATHS.includes(path)) {
    if (path === "/treinos-qualidade") await clearQualityWorkoutsSnapshot();
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate all cached pages
  await clearQualityWorkoutsSnapshot();
  PATHS.forEach((p) => revalidatePath(p));
  return NextResponse.json({ revalidated: true, paths: PATHS });
}

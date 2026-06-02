import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const PATHS = [
  "/treinos-qualidade",
  "/longoes",
  "/meias",
  "/corridas-brasil",
  "/corridas-mundo",
];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (path && PATHS.includes(path)) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate all cached pages
  PATHS.forEach((p) => revalidatePath(p));
  return NextResponse.json({ revalidated: true, paths: PATHS });
}

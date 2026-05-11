import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseSisrunWorkbook } from "@/app/lib/sisrun-xls-parser";

const SISRUN_KEY = "sisrun:latest";

async function saveToKV(data: unknown): Promise<void> {
  const { kv } = await import("@vercel/kv");
  await kv.set(SISRUN_KEY, JSON.stringify(data));
}

async function saveToFile(data: unknown): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const outputDir = path.join(process.cwd(), "data");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "sisrun-latest.json"),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xls") && !lowerName.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Envie um arquivo .xls ou .xlsx" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parsedData = parseSisrunWorkbook(workbook, file.name);

    const isVercel = !!process.env.KV_REST_API_URL;
    if (isVercel) {
      await saveToKV(parsedData);
    } else {
      await saveToFile(parsedData);
    }

    return NextResponse.json({
      success: true,
      storage: isVercel ? "kv" : "file",
      fileName: parsedData.fileName,
      athleteName: parsedData.athleteName,
      weeks: parsedData.weeks.length,
      rows: parsedData.rows.length,
    });
  } catch (error) {
    console.error("Erro ao processar planilha do SisRUN:", error);
    const message = error instanceof Error ? error.message : "Falha ao processar a planilha do SisRUN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

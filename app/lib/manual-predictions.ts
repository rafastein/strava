import fs from "fs/promises";
import path from "path";
import { getRedisClient } from "./redis-client";

export type ManualPredictions = {
  stravaMarathonPrediction: string;
};

export type ManualPredictionsSource = "redis" | "file" | "default";

export const MANUAL_PREDICTIONS_KEY = "manual-predictions:latest";
export const DEFAULT_MANUAL_PREDICTIONS: ManualPredictions = {
  stravaMarathonPrediction: "03:49:00",
};

const filePath = path.join(process.cwd(), "data", "manual-predictions.json");

function parsePredictions(raw: unknown): ManualPredictions | null {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Partial<ManualPredictions>).stravaMarathonPrediction === "string"
    ) {
      return {
        stravaMarathonPrediction: (parsed as ManualPredictions).stravaMarathonPrediction,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function readManualPredictions(): Promise<{
  data: ManualPredictions;
  source: ManualPredictionsSource;
}> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const raw = await redis.get<ManualPredictions | string>(MANUAL_PREDICTIONS_KEY);
      const data = parsePredictions(raw);
      if (data) return { data, source: "redis" };
    }
  } catch (error) {
    console.warn("Erro ao ler previsão manual no Redis:", error);
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = parsePredictions(content);
    if (data) return { data, source: "file" };
  } catch {
    // fallback silencioso para manter o dashboard funcionando sem arquivo local
  }

  return { data: DEFAULT_MANUAL_PREDICTIONS, source: "default" };
}

export async function writeManualPredictions(data: ManualPredictions): Promise<{
  data: ManualPredictions;
  source: Exclude<ManualPredictionsSource, "default">;
}> {
  const redis = await getRedisClient();

  if (redis) {
    await redis.set(MANUAL_PREDICTIONS_KEY, data);
    return { data, source: "redis" };
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return { data, source: "file" };
}

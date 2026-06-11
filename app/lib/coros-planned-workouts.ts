import {
  normalizeStructuredWorkout,
  saveStructuredPlannedWorkout,
  type StructuredPlannedWorkout,
} from "./planned-workout";

export type CorosScheduleEntry = {
  date: string;
  title: string;
  distanceKm?: number | string | null;
  estimatedTime?: string | null;
  durationMin?: number | string | null;
  loadTl?: number | string | null;
  raw?: unknown;
};

export type CorosScheduleImportPayload = {
  entries?: CorosScheduleEntry[];
  text?: string;
  preferredTitlesByDate?: Record<string, string>;
  dryRun?: boolean;
};

export type CorosScheduleImportResult = {
  key?: string;
  workout: StructuredPlannedWorkout;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCorosDurationToMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const parts = value.trim().split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.round(minutes + seconds / 60);
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  return parseNumber(value);
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseCorosTrainingScheduleText(text: string): CorosScheduleEntry[] {
  const lines = text
    .replace(/^"|"$/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^=+$/.test(line) && !/^training schedule$/i.test(line));

  const entries: CorosScheduleEntry[] = [];
  let index = 0;

  while (index < lines.length) {
    const dateLine = lines[index];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLine)) {
      index += 1;
      continue;
    }

    const date = dateLine;
    const title = lines[index + 1] ?? "Treino COROS";
    const distanceLine = lines[index + 2] ?? "";
    const estimatedTimeLine = lines[index + 3] ?? "";
    const loadLine = lines[index + 4] ?? "";

    const distanceKm = distanceLine.match(/Distance:\s*([\d.,]+)/i)?.[1] ?? null;
    const estimatedTime = estimatedTimeLine.match(/Estimated Time:\s*([\d:]+)/i)?.[1] ?? null;
    const loadTl = loadLine.match(/Load:\s*([\d.,]+)/i)?.[1] ?? null;

    entries.push({
      date,
      title,
      distanceKm,
      estimatedTime,
      loadTl,
      raw: { date, title, distanceLine, estimatedTimeLine, loadLine },
    });

    index += 5;
  }

  return entries;
}

export function normalizeCorosScheduleEntry(entry: CorosScheduleEntry): StructuredPlannedWorkout {
  const date = String(entry.date ?? "").trim();
  const title = String(entry.title ?? "Treino COROS").trim();
  const distanceKm = parseNumber(entry.distanceKm);
  const durationMin = parseCorosDurationToMinutes(entry.durationMin ?? entry.estimatedTime);
  const loadTl = parseNumber(entry.loadTl);

  return normalizeStructuredWorkout({
    date,
    source: "coros",
    title,
    distanceKm,
    durationMin,
    description: loadTl ? `Carga COROS: ${Math.round(loadTl)} TL` : null,
    externalId: `coros-schedule-${date}-${slugify(title)}`,
    importedAt: new Date().toISOString(),
    raw: {
      ...((entry.raw && typeof entry.raw === "object") ? entry.raw : {}),
      corosSchedule: {
        distanceKm,
        estimatedTime: entry.estimatedTime ?? null,
        durationMin,
        loadTl,
      },
    },
  });
}

export function dedupeCorosScheduleWorkouts(
  workouts: StructuredPlannedWorkout[],
  preferredTitlesByDate: Record<string, string> = {},
) {
  const byDate = new Map<string, StructuredPlannedWorkout[]>();

  for (const workout of workouts) {
    byDate.set(workout.date, [...(byDate.get(workout.date) ?? []), workout]);
  }

  return Array.from(byDate.entries())
    .map(([date, candidates]) => {
      const preferredTitle = normalizeText(preferredTitlesByDate[date]);
      if (preferredTitle) {
        const preferred = candidates.find((candidate) => normalizeText(candidate.title).includes(preferredTitle));
        if (preferred) return preferred;
      }

      const withoutDatePrefix = candidates.find((candidate) => !/^\d{2}\/\d{2}/.test(candidate.title));
      if (withoutDatePrefix) return withoutDatePrefix;

      return candidates
        .slice()
        .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0) || (b.durationMin ?? 0) - (a.durationMin ?? 0))[0];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCorosScheduleWorkouts(payload: CorosScheduleImportPayload) {
  const entries = payload.entries?.length ? payload.entries : parseCorosTrainingScheduleText(payload.text ?? "");
  const normalized = entries.map(normalizeCorosScheduleEntry);
  return dedupeCorosScheduleWorkouts(normalized, payload.preferredTitlesByDate);
}

export async function importCorosSchedule(payload: CorosScheduleImportPayload): Promise<{
  imported: CorosScheduleImportResult[];
  dryRun: boolean;
}> {
  const workouts = buildCorosScheduleWorkouts(payload);

  if (payload.dryRun) {
    return {
      imported: workouts.map((workout) => ({ workout })),
      dryRun: true,
    };
  }

  const imported = await Promise.all(
    workouts.map(async (workout) => {
      const result = await saveStructuredPlannedWorkout(workout);
      return { key: result.key, workout: result.workout };
    }),
  );

  return { imported, dryRun: false };
}

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

function isScheduleDateLine(line: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(line.trim());
}

function parseDateFromTitle(title: string, fallbackDate: string) {
  const match = title.trim().match(/^(\d{1,2})\/(\d{1,2})\b/);
  if (!match) return fallbackDate;

  const fallbackYear = Number(fallbackDate.match(/^(\d{4})-/)?.[1]);
  if (!fallbackYear) return fallbackDate;

  const [, day, month] = match;
  const date = new Date(fallbackYear, Number(month) - 1, Number(day), 12, 0, 0);
  if (!Number.isFinite(date.getTime())) return fallbackDate;

  const iso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return iso;
}

function findFirstMatch(lines: string[], pattern: RegExp) {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function getTitleFromCorosBlock(blockLines: string[]) {
  const titleLine = blockLines.find((line) => {
    if (/^(distance|estimated time|load)\s*:/i.test(line)) return false;
    if (/^[-=]+$/.test(line)) return false;
    return Boolean(line.trim());
  });

  return titleLine ?? "Treino COROS";
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
    if (!isScheduleDateLine(dateLine)) {
      index += 1;
      continue;
    }

    const block: string[] = [];
    let cursor = index + 1;

    while (cursor < lines.length && !isScheduleDateLine(lines[cursor])) {
      block.push(lines[cursor]);
      cursor += 1;
    }

    const title = getTitleFromCorosBlock(block);
    const date = parseDateFromTitle(title, dateLine);
    const distanceKm = findFirstMatch(block, /Distance:\s*([\d.,]+)/i);
    const estimatedTime = findFirstMatch(block, /Estimated Time:\s*([\d:]+)/i);
    const loadTl = findFirstMatch(block, /Load:\s*([\d.,]+)/i);

    entries.push({
      date,
      title,
      distanceKm,
      estimatedTime,
      loadTl,
      raw: { originalDate: dateLine, date, title, block },
    });

    index = cursor;
  }

  return entries;
}

export function normalizeCorosScheduleEntry(entry: CorosScheduleEntry): StructuredPlannedWorkout {
  const fallbackDate = String(entry.date ?? "").trim();
  const title = String(entry.title ?? "Treino COROS").trim();
  const date = parseDateFromTitle(title, fallbackDate);
  const distanceKm = parseNumber(entry.distanceKm);
  const durationMin = parseCorosDurationToMinutes(entry.durationMin ?? entry.estimatedTime);
  const loadTl = parseNumber(entry.loadTl);

  return normalizeStructuredWorkout({
    date,
    source: "coros",
    title,
    distanceKm,
    durationMin,
    estimatedTime: entry.estimatedTime ?? null,
    loadTl,
    description: loadTl ? `Carga COROS: ${Math.round(loadTl)} TL` : null,
    externalId: `coros-schedule-${date}-${slugify(title)}`,
    importedAt: new Date().toISOString(),
    raw: {
      ...((entry.raw && typeof entry.raw === "object") ? entry.raw : {}),
      corosSchedule: {
        originalDate: fallbackDate,
        date,
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

import type { PlannedWorkoutStep } from "./planned-workout";

// Detalhes de cada treino do COROS: o MCP devolve a descrição escrita pela assessoria
// ("1. Aquecer por 10min - Intensidade Z1 - Leve (Pace: 05:44 a 07:22 min/km | ...)").
// Aqui ela vira etapas (aquecimento, blocos repetidos, desaquecimento), observações e percurso.

export type CorosCourseDetail = {
  date: string;
  name: string;
  description: string;
};

export type ParsedWorkoutDetail = {
  steps: PlannedWorkoutStep[];
  notes: string | null;
  route: string | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "10min", "5km", "400m", "1h20", "1h", "30s", "2:30" → duração em min ou distância em km. */
export function parseAmount(text: string): { durationMin: number | null; distanceKm: number | null } {
  const value = text.trim().toLowerCase();

  const km = /^(\d+(?:[.,]\d+)?)\s*km\b/.exec(value);
  if (km) return { durationMin: null, distanceKm: Number(km[1].replace(",", ".")) };

  const meters = /^(\d+(?:[.,]\d+)?)\s*m\b(?!in)/.exec(value);
  if (meters) return { durationMin: null, distanceKm: Number(meters[1].replace(",", ".")) / 1000 };

  const hours = /^(\d+)\s*h\s*(\d{1,2})?\b/.exec(value);
  if (hours) return { durationMin: Number(hours[1]) * 60 + Number(hours[2] ?? 0), distanceKm: null };

  const minutes = /^(\d+(?:[.,]\d+)?)\s*min/.exec(value);
  if (minutes) return { durationMin: Number(minutes[1].replace(",", ".")), distanceKm: null };

  const seconds = /^(\d+)\s*(?:s|seg)\b/.exec(value);
  if (seconds) return { durationMin: Math.round((Number(seconds[1]) / 60) * 100) / 100, distanceKm: null };

  const clock = /^(\d{1,2}):(\d{2})\b/.exec(value);
  if (clock) return { durationMin: Number(clock[1]) + Number(clock[2]) / 60, distanceKm: null };

  return { durationMin: null, distanceKm: null };
}

function stepKind(verb: string, zone: number | null, insideRepeat: boolean): PlannedWorkoutStep["kind"] {
  const text = normalize(verb);
  if (text.startsWith("desaquec")) return "desaquecimento";
  if (text.startsWith("aquec")) return "aquecimento";
  if (/^(caminh|trot|recuper|descans|pausa)/.test(text)) return "recuperacao";
  if (insideRepeat && zone !== null && zone <= 1) return "recuperacao";
  return "bloco";
}

/** Uma linha de etapa: "Correr por 5min - Intensidade Z2 - Leve/Moderada (Pace: 04:32 a 05:44 min/km | ...)". */
export function parseStepLine(line: string, insideRepeat = false): PlannedWorkoutStep | null {
  const text = line.replace(/^\s*(?:\d+\.|-|•)\s*/, "").trim();
  if (!text) return null;

  const [head] = text.split(/\s+-\s+intensidade/i);
  const zoneMatch = /intensidade\s+z\s*(\d)/i.exec(text);
  const zone = zoneMatch ? Number(zoneMatch[1]) : null;
  const zoneLabel = /intensidade\s+z\s*\d\s*-\s*([^(]+?)\s*(?:\(|$)/i.exec(text)?.[1]?.trim() ?? null;
  const pace = /pace:\s*(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})/i.exec(text);

  const verbAndAmount = /^(.+?)\s+por\s+(.+)$/i.exec(head.trim());
  const verb = verbAndAmount?.[1] ?? head.trim();
  const amount = verbAndAmount ? parseAmount(verbAndAmount[2]) : { durationMin: null, distanceKm: null };

  return {
    label: head.trim(),
    repeat: null,
    distanceKm: amount.distanceKm,
    durationMin: amount.durationMin,
    intensity: zone !== null ? `Z${zone}${zoneLabel ? ` ${zoneLabel.toLowerCase()}` : ""}` : null,
    target: pace ? `${pace[1]}–${pace[2]}/km` : null,
    kind: stepKind(verb, zone, insideRepeat),
  };
}

/** Descrição completa do COROS → etapas, observações e percurso. */
export function parseCorosCourseDescription(description: string): ParsedWorkoutDetail {
  const text = description.replace(/\r\n?/g, "\n");
  const [body, details = ""] = text.split(/-{2,}\s*detalhes do treino\s*-{2,}/i);

  const route = /^\s*percurso:\s*(.+)$/im.exec(details)?.[1]?.trim() || null;

  const steps: PlannedWorkoutStep[] = [];
  const notes: string[] = [];
  let group: PlannedWorkoutStep | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      group = group && group.children?.length ? null : group;
      continue;
    }

    const numbered = /^\d+\.\s*(.+)$/.exec(line);
    if (numbered) {
      const repeat = /^repetir\s+(\d+)\s*x?/i.exec(numbered[1].trim());
      if (repeat) {
        group = { label: `Repetir ${repeat[1]}×`, repeat: Number(repeat[1]), kind: "bloco", children: [] };
        steps.push(group);
      } else {
        group = null;
        const step = parseStepLine(numbered[1]);
        if (step) steps.push(step);
      }
      continue;
    }

    if (/^[-•]\s*/.test(line) && group) {
      const child = parseStepLine(line, true);
      if (child) group.children = [...(group.children ?? []), child];
      continue;
    }

    group = null;
    notes.push(line);
  }

  return {
    steps: steps.filter((step) => !step.children || step.children.length > 0),
    notes: notes.length ? notes.join("\n") : null,
    route,
  };
}

/**
 * Os "Course JSON: {...}" de uma resposta de queryTrainingPlanDetails ou queryScheduledWorkoutDetails,
 * cada um com a data do dia em que aparece.
 */
export function extractCorosCourses(text: string, fallbackDate: string | null = null): CorosCourseDetail[] {
  const courses: CorosCourseDetail[] = [];
  let currentDate = fallbackDate;

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const day = /^day\s+\d+\s*-\s*(\d{4}-\d{2}-\d{2})/i.exec(line.trim());
    if (day) {
      currentDate = day[1];
      continue;
    }

    const json = /course json:\s*(\{.*\})\s*$/i.exec(line.trim());
    if (!json || !currentDate) continue;

    try {
      const course = JSON.parse(json[1]) as { courseName?: unknown; name?: unknown; courseDescription?: unknown; description?: unknown };
      const name = String(course.courseName ?? course.name ?? "").trim();
      const description = String(course.courseDescription ?? course.description ?? "");
      if (description.trim()) courses.push({ date: currentDate, name, description });
    } catch {
      // Linha cortada ou fora do formato: fica sem detalhe, o resto segue.
    }
  }

  return courses;
}

/** O treino da agenda que corresponde a este curso: mesmo dia e mesmo nome; sem nome igual, o único do dia. */
export function findCourseForWorkout(courses: CorosCourseDetail[], date: string, title: string) {
  const sameDay = courses.filter((course) => course.date === date);
  return sameDay.find((course) => normalize(course.name) === normalize(title)) ?? (sameDay.length === 1 ? sameDay[0] : null);
}

/** Janelas de até 28 dias (o limite de queryTrainingPlanDetails) cobrindo o intervalo. */
export function splitIntoWindows(startKey: string, endKey: string, maxDays = 28) {
  const DAY = 86_400_000;
  const toUtc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  const toKey = (time: number) => new Date(time).toISOString().slice(0, 10);
  const windows: Array<{ start: string; end: string }> = [];
  for (let cursor = toUtc(startKey); cursor <= toUtc(endKey); cursor += maxDays * DAY) {
    windows.push({ start: toKey(cursor), end: toKey(Math.min(cursor + (maxDays - 1) * DAY, toUtc(endKey))) });
  }
  return windows;
}

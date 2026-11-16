// Formatação única em pt-BR: vírgula decimal, ponto de milhar, unidades em minúsculas.

const numberFormatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
}

export function formatKm(km: number, digits = 1): string {
  return Number.isFinite(km) ? `${formatNumber(km, digits)} km` : "—";
}

/** Pace a partir de segundos por km: 329 → "5:29/km". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const rounded = Math.round(secPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/km`;
}

/** Pace a partir de distância (m) e tempo (s). */
export function formatPaceFromDistance(distanceM: number, timeSec: number): string {
  if (!distanceM || !timeSec) return "—";
  return formatPace(timeSec / (distanceM / 1000));
}

/** Duração: 2703 → "45:03", 3829 → "1:03:49". */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return "—";
  const rounded = Math.round(totalSec);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function dateFromKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return null;
  // Meio-dia UTC: a data formatada nunca escorrega de dia por causa de fuso.
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function formatKeyPart(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  const date = dateFromKey(dateKey);
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options })
    .format(date)
    .replace(/\./g, "");
}

/** "2026-11-12" → "qui" */
export function formatWeekdayShort(dateKey: string): string {
  return formatKeyPart(dateKey, { weekday: "short" });
}

/** "2026-11-15" → "domingo" */
export function formatWeekdayLong(dateKey: string): string {
  return formatKeyPart(dateKey, { weekday: "long" }).replace("-feira", "");
}

/** "2026-11-12" → "12 nov" */
export function formatDayMonth(dateKey: string): string {
  return formatKeyPart(dateKey, { day: "2-digit", month: "short" }).replace(" de ", " ");
}

/** "2026-11-13" → "sexta, 13 de novembro" */
export function formatLongDate(dateKey: string): string {
  const weekday = formatWeekdayLong(dateKey);
  const dayMonth = formatKeyPart(dateKey, { day: "numeric", month: "long" });
  return weekday && dayMonth ? `${weekday}, ${dayMonth}` : "";
}

/** "9–15 nov" ou "28 set – 4 out": faixa curta de uma semana. */
export function formatDateRangeShort(startKey: string, endKey: string): string {
  const parse = (key: string) => {
    const [day, month] = formatDayMonth(key).split(" ");
    return { day: String(Number(day)), month };
  };
  const start = parse(startKey);
  const end = parse(endKey);
  return start.month === end.month
    ? `${start.day}–${end.day} ${end.month}`
    : `${start.day} ${start.month} – ${end.day} ${end.month}`;
}

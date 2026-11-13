const SEASON_TIME_ZONE = "America/Sao_Paulo";

/** Ano da temporada corrente, no fuso de São Paulo. */
export function getCurrentSeasonYear(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: SEASON_TIME_ZONE, year: "numeric" }).format(now),
  );
}

/** Ano de uma chave YYYY-MM-DD (ou de um timestamp local do Strava). */
export function getYearFromDateKey(dateKey: string | null | undefined): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(dateKey ?? "");
  return match ? Number(match[1]) : null;
}

/** Limites da temporada em epoch (segundos), como a API do Strava espera. */
export function getSeasonEpochRange(year: number) {
  return {
    after: Math.floor(Date.UTC(year, 0, 1) / 1000),
    before: Math.floor(Date.UTC(year + 1, 0, 1) / 1000),
  };
}

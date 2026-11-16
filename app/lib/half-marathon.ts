// Pace de referência de uma meia: tempo da prova ÷ distância. A média dos splits fica
// só como reserva, porque arredonda e empata entre provas parecidas.

type HalfPaceInput = {
  timeSec?: number | null;
  distanceKm: number;
  splits: { paceSecPerKm: number }[];
};

export function getSplitsAveragePace(race: Pick<HalfPaceInput, "splits">) {
  const paces = race.splits.map((split) => split.paceSecPerKm).filter((pace) => pace > 0 && pace < 900);
  return paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : 0;
}

export function getHalfRacePace(race: HalfPaceInput) {
  if (race.timeSec && race.timeSec > 0 && race.distanceKm > 0) return race.timeSec / race.distanceKm;
  return getSplitsAveragePace(race);
}

/** Índice da prova de melhor pace; -1 se nenhuma tiver pace válido. Empate: a mais recente (menor índice). */
export function getBestHalfIndex(races: HalfPaceInput[]) {
  let best = -1;
  races.forEach((race, index) => {
    const pace = getHalfRacePace(race);
    if (pace > 0 && (best < 0 || pace < getHalfRacePace(races[best]))) best = index;
  });
  return best;
}

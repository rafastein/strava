import type { CSSProperties } from "react";

type CyclePhaseSectionProps = {
  raceDate: Date;
  daysToRace: number;
  weeksToRace: number;
  currentWeekKm: number;
  plannedWeekKm: number;
  currentWeekLongestRunKm: number;
  longestRunKm: number;
  longRuns28Plus: number;
  weeklyAdherencePct: number;
};

export type PhaseKey = "base" | "development" | "specific" | "peak" | "taper";

export type Phase = {
  key: PhaseKey;
  label: string;
  shortLabel: string;
  startWeek: number;
  endWeek: number;
  description: string;
  focus: string[];
};

export type MarathonCycleInfo = {
  phase: Phase;
  phaseIndex: number;
  startDate: Date;
  endDate: Date;
  dateRangeLabel: string;
  progress: number;
  phaseDateRanges: Record<PhaseKey, string>;
};

const PHASES: Phase[] = [
  {
    key: "base",
    label: "Base / Consolidação",
    shortLabel: "Base",
    startWeek: 24,
    endWeek: 17,
    description:
      "Construir consistência, fortalecer o corpo e sustentar volume sem acumular fadiga desnecessária.",
    focus: ["consistência semanal", "Z2 bem controlado", "força e mobilidade"],
  },
  {
    key: "development",
    label: "Desenvolvimento",
    shortLabel: "Desenv.",
    startWeek: 16,
    endWeek: 11,
    description:
      "Elevar a capacidade aeróbica, consolidar volume e transformar condicionamento em ritmo sustentável.",
    focus: ["volume progressivo", "ritmos moderados", "provas como estímulo"],
  },
  {
    key: "specific",
    label: "Específico de Maratona",
    shortLabel: "Específico",
    startWeek: 10,
    endWeek: 5,
    description:
      "Aproximar o treino da prova: longões maiores, blocos em ritmo de maratona, gel, hidratação e estratégia.",
    focus: ["longões progressivos", "ritmo de maratona", "nutrição em treino"],
  },
  {
    key: "peak",
    label: "Pico",
    shortLabel: "Pico",
    startWeek: 4,
    endWeek: 3,
    description:
      "Concentrar o maior bloco útil do ciclo, com longão-chave e alta especificidade antes da redução de carga.",
    focus: ["longão-chave", "simulação de prova", "controle de fadiga"],
  },
  {
    key: "taper",
    label: "Polimento / Taper",
    shortLabel: "Taper",
    startWeek: 2,
    endWeek: 0,
    description:
      "Reduzir volume, manter o corpo ativo e chegar descansado, confiante e afiado para a largada.",
    focus: ["redução de volume", "sono e recuperação", "chegar inteiro"],
  },
];

const PHASE_INDEX: Record<PhaseKey, number> = {
  base: 0,
  development: 1,
  specific: 2,
  peak: 3,
  taper: 4,
};

function getPhaseKey(weeksToRace: number): PhaseKey {
  if (weeksToRace <= 2) return "taper";
  if (weeksToRace <= 4) return "peak";
  if (weeksToRace <= 10) return "specific";
  if (weeksToRace <= 16) return "development";
  return "base";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = normalizeDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function subtractWeeks(date: Date, weeks: number) {
  return addDays(date, -weeks * 7);
}

function getPhaseStartDate(raceDate: Date, phase: Phase) {
  return subtractWeeks(raceDate, phase.startWeek);
}

function getPhaseEndDate(raceDate: Date, phase: Phase) {
  if (phase.endWeek <= 0) return normalizeDate(raceDate);

  // endWeek é inclusiva. Ex.: 17 semanas termina no sábado anterior
  // ao início da semana 16.
  return addDays(subtractWeeks(raceDate, phase.endWeek - 1), -1);
}

function formatDateRangePart(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateRange(startDate: Date, endDate: Date) {
  return `${formatDateRangePart(startDate)}–${formatDateRangePart(endDate)}`;
}

function getProgressByWeeks(weeksToRace: number) {
  // Janela visual de 24 semanas até a prova.
  // 24 semanas = início da barra; 0 semana = chegada.
  return clamp(((24 - weeksToRace) / 24) * 100, 0, 100);
}

export function getMarathonCyclePhase({
  raceDate,
  weeksToRace,
}: {
  raceDate: Date;
  weeksToRace: number;
}): MarathonCycleInfo {
  const phaseKey = getPhaseKey(weeksToRace);
  const phase = PHASES.find((item) => item.key === phaseKey) ?? PHASES[0];

  const phaseDateRanges = PHASES.reduce(
    (acc, item) => {
      const startDate = getPhaseStartDate(raceDate, item);
      const endDate = getPhaseEndDate(raceDate, item);
      acc[item.key] = formatDateRange(startDate, endDate);
      return acc;
    },
    {} as Record<PhaseKey, string>,
  );

  const startDate = getPhaseStartDate(raceDate, phase);
  const endDate = getPhaseEndDate(raceDate, phase);

  return {
    phase,
    phaseIndex: PHASE_INDEX[phase.key],
    startDate,
    endDate,
    dateRangeLabel: formatDateRange(startDate, endDate),
    progress: getProgressByWeeks(weeksToRace),
    phaseDateRanges,
  };
}

function formatKm(value: number) {
  if (!Number.isFinite(value)) return "0 km";
  return `${value.toFixed(1).replace(".", ",")} km`;
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function getNextMilestone(phaseKey: PhaseKey, currentWeekLongestRunKm: number) {
  if (phaseKey === "base") {
    return "Consolidar semanas constantes antes de subir a carga específica.";
  }

  if (phaseKey === "development") {
    return currentWeekLongestRunKm >= 21
      ? "Manter consistência e preparar a transição para longões mais específicos."
      : "Estabilizar longões acima de 20 km com boa recuperação.";
  }

  if (phaseKey === "specific") {
    return currentWeekLongestRunKm >= 28
      ? "Testar ritmo de maratona, hidratação e gel dentro dos longões."
      : "Construir longões entre 24 km e 28 km antes do longão-chave.";
  }

  if (phaseKey === "peak") {
    return "Executar o longão-chave sem transformar o treino em prova.";
  }

  return "Dormir bem, reduzir ruído e chegar descansado na linha de largada.";
}

function getStatusTone(
  phaseKey: PhaseKey,
  weeklyAdherencePct: number,
  currentWeekLongestRunKm: number,
  longRuns28Plus: number,
) {
  if (phaseKey === "taper") return "polishing";

  if (phaseKey === "peak") {
    if (currentWeekLongestRunKm >= 28 || longRuns28Plus > 0) return "on-track";
    return "attention";
  }

  if (phaseKey === "specific") {
    if (currentWeekLongestRunKm >= 24 && weeklyAdherencePct >= 85) {
      return "on-track";
    }

    if (weeklyAdherencePct < 70) return "attention";
    return "building";
  }

  if (weeklyAdherencePct >= 85) return "on-track";
  if (weeklyAdherencePct < 70) return "attention";
  return "building";
}

function getStatusLabel(tone: string) {
  if (tone === "on-track") return "No caminho";
  if (tone === "attention") return "Ponto de atenção";
  if (tone === "polishing") return "Hora de absorver";
  return "Em construção";
}

export default function CyclePhaseSection({
  raceDate,
  daysToRace,
  weeksToRace,
  currentWeekKm,
  plannedWeekKm,
  currentWeekLongestRunKm,
  longestRunKm,
  longRuns28Plus,
  weeklyAdherencePct,
}: CyclePhaseSectionProps) {
  const cycle = getMarathonCyclePhase({ raceDate, weeksToRace });
  const currentPhase = cycle.phase;
  const currentIndex = cycle.phaseIndex;
  const nextMilestone = getNextMilestone(
    currentPhase.key,
    currentWeekLongestRunKm,
  );

  const statusTone = getStatusTone(
    currentPhase.key,
    weeklyAdherencePct,
    currentWeekLongestRunKm,
    longRuns28Plus,
  );

  const adherenceLabel =
    plannedWeekKm > 0
      ? `${formatPct(weeklyAdherencePct)} da semana planejada`
      : "sem SisRUN carregado";

  return (
    <section
      className="ba-card marathon-cycle-card"
      style={{ "--cycle-progress": `${cycle.progress}%` } as CSSProperties}
    >
      <div className="marathon-cycle-card__glow" />

      <div className="marathon-cycle-card__header">
        <div>
          <p className="ba-label">Ciclo Buenos Aires 2026</p>
          <h2 className="marathon-cycle-card__title">
            Fase atual: {currentPhase.label}
          </h2>
          <p className="marathon-cycle-card__subtitle">
            {weeksToRace} semanas / {daysToRace} dias até a maratona.{" "}
            {currentPhase.description}
          </p>
        </div>

        <div
          className={`marathon-cycle-card__status marathon-cycle-card__status--${statusTone}`}
        >
          <span>{getStatusLabel(statusTone)}</span>
        </div>
      </div>

      <div
        className="marathon-cycle-timeline"
        aria-label="Linha do tempo do ciclo de treinamento"
      >
        <div className="marathon-cycle-timeline__track">
          <div className="marathon-cycle-timeline__progress" />
        </div>

        <div className="marathon-cycle-timeline__steps">
          {PHASES.map((phase, index) => {
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div
                key={phase.key}
                className={[
                  "marathon-cycle-step",
                  isPast ? "marathon-cycle-step--past" : "",
                  isCurrent ? "marathon-cycle-step--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="marathon-cycle-step__dot">
                  {isCurrent && <span className="marathon-cycle-step__pulse" />}
                </div>

                <div className="marathon-cycle-step__content">
                  <span className="marathon-cycle-step__label">
                    {phase.shortLabel}
                  </span>
                  <span className="marathon-cycle-step__range">
                    {cycle.phaseDateRanges[phase.key]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="marathon-cycle-card__grid">
        <div className="marathon-cycle-focus">
          <p className="marathon-cycle-focus__eyebrow">Prioridade da fase</p>
          <ul>
            {currentPhase.focus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="marathon-cycle-metrics">
          <div>
            <span>Semana atual</span>
            <strong>{formatKm(currentWeekKm)}</strong>
            <small>{adherenceLabel}</small>
          </div>

          <div>
            <span>Maior longão da semana</span>
            <strong>{formatKm(currentWeekLongestRunKm)}</strong>
            <small>maior histórico: {formatKm(longestRunKm)}</small>
          </div>

          <div>
            <span>Longões 28 km+</span>
            <strong>{longRuns28Plus}</strong>
            <small>marco-chave do bloco específico</small>
          </div>
        </div>
      </div>

      <div className="marathon-cycle-next">
        <span>Próximo marco</span>
        <strong>{nextMilestone}</strong>
      </div>
    </section>
  );
}

import type { WeekEntry } from "./weekly-plan-utils";
import { getWeeklyPlanSummary } from "./weekly-plan-utils";

export default function WeeklyPlanSummary({ weeks }: { weeks: WeekEntry[] }) {
  if (weeks.length === 0) return null;

  const { validWeeks, weeksOnTarget, bestWeekKm, averageWeekKm } = getWeeklyPlanSummary(weeks);

  return (
    <div className="weekly-plan-card__summary-grid">
      <div className="grid grid-cols-1 gap-3 text-center text-[11px] sm:grid-cols-3">
        <div>
          <p className="text-white/30">Semanas no alvo</p>
          <p className="mt-1 text-[12px] font-semibold text-white/88">
            {weeksOnTarget}/{validWeeks.length}
          </p>
        </div>

        <div>
          <p className="text-white/30">Melhor semana</p>
          <p className="mt-1 text-[12px] font-semibold text-white/88">
            {bestWeekKm.toFixed(1)} km
          </p>
        </div>

        <div>
          <p className="text-white/30">Média semanal</p>
          <p className="mt-1 text-[12px] font-semibold text-white/88">
            {averageWeekKm.toFixed(1)} km
          </p>
        </div>
      </div>
    </div>
  );
}

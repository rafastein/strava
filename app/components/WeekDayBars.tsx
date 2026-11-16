import { formatKm, formatNumber } from "../lib/format";
import type { WeekDay } from "../lib/home-week";

/**
 * Barras de segunda a domingo: o planejado é o contorno, o feito preenche por cima,
 * na mesma escala (`maxKm`).
 */
export default function WeekDayBars({
  days,
  todayKey,
  maxKm,
  showLegend = false,
  compact = false,
}: {
  days: WeekDay[];
  todayKey: string;
  maxKm: number;
  showLegend?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      <ul className={`hoje-week__days${compact ? " hoje-week__days--compact" : ""}`} style={{ listStyle: "none" }}>
        {days.map((day) => {
          const upcomingRace = day.isRaceDay && day.km === 0 && day.dateKey >= todayKey;
          const doneHeight = day.km > 0 ? Math.max((day.km / maxKm) * 100, 6) : 0;
          const plannedHeight = day.plannedKm > 0 ? Math.max((day.plannedKm / maxKm) * 100, 6) : 0;
          const valueLabel = day.km > 0
            ? formatNumber(day.km, 1)
            : day.plannedKm > 0
              ? formatNumber(day.plannedKm, day.plannedKm % 1 === 0 ? 0 : 1)
              : upcomingRace
                ? "prova"
                : "";
          const srText = [
            day.plannedKm > 0 ? `planejado ${formatKm(day.plannedKm)}` : null,
            day.km > 0 ? `feito ${formatKm(day.km)}` : day.dateKey <= todayKey && day.plannedKm > 0 ? "nada feito" : null,
            upcomingRace ? "dia de prova" : null,
          ].filter(Boolean).join(", ");

          return (
            <li key={day.dateKey} className="hoje-day">
              <span className={`hoje-day__value${day.km > 0 ? "" : " hoje-day__value--muted"}`} aria-hidden="true">
                {valueLabel}
              </span>
              <span className="hoje-day__track" aria-hidden="true">
                {plannedHeight > 0 ? (
                  <span className={`hoje-day__plan${upcomingRace ? " hoje-day__plan--race" : ""}`} style={{ height: `${plannedHeight}%` }} />
                ) : null}
                {doneHeight > 0 ? (
                  <span className="hoje-day__bar" style={{ height: `${doneHeight}%` }} />
                ) : plannedHeight === 0 ? (
                  <span className={`hoje-day__bar ${upcomingRace ? "hoje-day__bar--race" : "hoje-day__bar--empty"}`} />
                ) : null}
              </span>
              <span className={`hoje-day__label${day.isToday ? " hoje-day__label--today" : ""}`}>
                {day.weekday}
                <span className="sr-only">{day.isToday ? " (hoje)" : ""}{srText ? `: ${srText}` : ""}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {showLegend ? (
        <div className="carga-legend" style={{ fontSize: 12 }} aria-hidden="true">
          <span className="carga-legend__item"><span className="hoje-legend-swatch" />feito</span>
          <span className="carga-legend__item"><span className="hoje-legend-swatch hoje-legend-swatch--plan" />planejado</span>
        </div>
      ) : null}
    </>
  );
}

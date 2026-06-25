import type { DecoratedWeekEntry } from "./weekly-plan-utils";

export default function WeeklyProgressCards({ weeks }: { weeks: DecoratedWeekEntry[] }) {
  return (
    <div className="weekly-current-list">
      {weeks.map((week) => (
        <article
          key={week.label}
          className={[
            "weekly-progress-card",
            week.statusClass,
            week.isCurrent ? "weekly-progress-card--current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="weekly-progress-card__header">
            <div>
              <div className="weekly-progress-card__title-row">
                <h3>{week.label}</h3>
                {week.isCurrent && <span>Semana atual</span>}
              </div>
              <p>Progresso real</p>
            </div>

            <div className="weekly-progress-card__summary">
              <strong>
                {week.actual.toFixed(1)} / {week.planned.toFixed(1)} km
              </strong>
              <span>{week.adherence.toFixed(0)}% de aderência</span>
            </div>
          </div>

          <div className="weekly-progress-card__bar">
            <div style={{ width: `${Math.min(week.adherence, 100)}%` }} />
          </div>

          <div className="weekly-progress-card__metrics">
            <div>
              <span>Planejado</span>
              <strong>{week.planned.toFixed(1)} km</strong>
            </div>

            <div>
              <span>Executado</span>
              <strong>{week.actual.toFixed(1)} km</strong>
            </div>

            <div>
              <span>Aderência</span>
              <strong>{week.adherence.toFixed(0)}%</strong>
            </div>
          </div>

          <p className="weekly-progress-card__message">{week.message}</p>
        </article>
      ))}
    </div>
  );
}

"use client";

import { formatKm, formatNumber } from "../lib/format";

type WeeklyItem = {
  label?: string;
  weekLabel?: string;
  week?: string;
  range?: string;
  plannedKm?: number;
  planned?: number;
  totalPlannedKm?: number;
  executedKm?: number;
  doneKm?: number;
  actualKm?: number;
  stravaKm?: number;
  adherencePct?: number | null;
  adherence?: number | null;

  // Vem do buildWeeklyComparison(), em app/lib/sisrun-utils.ts
  isCurrentWeek?: boolean;

  // Mantidos por compatibilidade com usos antigos.
  isCurrent?: boolean;
  current?: boolean;
};

type Props = {
  items: WeeklyItem[];
  title?: string;
  subtitle?: string;
  orderLabel?: string;
  dark?: boolean;
};

function getNumber(...values: Array<number | undefined | null>) {
  const value = values.find((v) => typeof v === "number" && !Number.isNaN(v));
  return value ?? 0;
}

function getLabel(item: WeeklyItem) {
  return item.label ?? item.weekLabel ?? item.week ?? item.range ?? "Semana";
}

function parseBrDatePart(value: string, fallbackYear: number) {
  const [day, month, year] = value.trim().split("/").map(Number);

  if (!day || !month) return null;

  return new Date(year || fallbackYear, month - 1, day, 12, 0, 0, 0);
}

function isCurrentWeekLabel(label: string) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const normalized = label
    .replace(/\s/g, "")
    .replace(/[–—]/g, "-");

  const [startRaw, endRaw] = normalized.split("-");

  if (!startRaw || !endRaw) return false;

  const start = parseBrDatePart(startRaw, currentYear);
  const end = parseBrDatePart(endRaw, currentYear);

  if (!start || !end) return false;

  if (end.getTime() < start.getTime()) {
    end.setFullYear(end.getFullYear() + 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return now >= start && now <= end;
}

export default function WeeklyComparisonChart({
  items,
  title = "Planejado x executado por semana",
  subtitle = "Volume planejado no SisRUN comparado com o executado no Strava.",
  orderLabel = "Da semana mais recente para a mais antiga",
}: Props) {
  return (
    <section className="ui-section" aria-label={title}>
      <div className="ui-section__head">
        <h2 className="ui-h2">{title}</h2>
        <span className="ui-muted">{orderLabel.toLowerCase()}</span>
      </div>
      <div className="ui-card ui-list">
        {items.map((item, index) => {
          const plannedKm = getNumber(item.plannedKm, item.planned, item.totalPlannedKm);
          const executedKm = getNumber(item.executedKm, item.doneKm, item.actualKm, item.stravaKm);
          const adherencePct =
            item.adherencePct ?? item.adherence ?? (plannedKm > 0 ? (executedKm / plannedKm) * 100 : 0);
          const progressPct = plannedKm > 0 ? Math.min((executedKm / plannedKm) * 100, 100) : 0;
          const label = getLabel(item);
          const isCurrent = Boolean(item.isCurrentWeek ?? item.isCurrent ?? item.current ?? isCurrentWeekLabel(label));

          // Semana sem treino planejado: não existe aderência nem "falta" a calcular.
          const hasPlan = plannedKm > 0;
          const isDone = hasPlan && adherencePct >= 100;
          const isPartial = adherencePct >= 70 && adherencePct < 100;
          const barColor = isDone ? "var(--ui-good)" : isCurrent || isPartial ? "var(--ui-accent)" : "#ff8a7a";

          return (
            <div key={`${label}-${index}`} className="ui-row" style={{ alignItems: "stretch", flexDirection: "column", gap: 8, paddingTop: 14, paddingBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <span className="ui-row__title">
                  {label}
                  {isCurrent ? <span className="ui-tag-accent"> · semana atual</span> : null}
                </span>
                <span className="ui-num" style={{ fontSize: 15, whiteSpace: "nowrap" }}>
                  {hasPlan ? `${formatNumber(executedKm, 1)} de ${formatKm(plannedKm)}` : formatKm(executedKm)}
                </span>
              </div>
              <div className="hoje-progress" role="img" aria-label={hasPlan ? `${formatNumber(adherencePct)}% do planejado` : "sem plano"}>
                <div className="hoje-progress__fill" style={{ width: `${progressPct}%`, background: barColor }} />
              </div>
              <span className="ui-muted">
                {!hasPlan
                  ? "Nenhum treino planejado para esta semana."
                  : isDone
                    ? `Meta cumprida · ${formatNumber(adherencePct)}%${executedKm > plannedKm ? `, ${formatKm(executedKm - plannedKm)} a mais` : ""}`
                    : `${formatNumber(adherencePct)}% · faltam ${formatKm(Math.max(plannedKm - executedKm, 0))}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="ui-muted" style={{ padding: "0 4px" }}>{subtitle}</p>
    </section>
  );
}

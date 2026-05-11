type WeeklyComparisonItem = {
  label: string;
  plannedKm?: number | null;
  actualKm?: number | null;
  executedKm?: number | null;
  completedKm?: number | null;
  adherencePct?: number | null;
  isCurrentWeek?: boolean | null;
  current?: boolean | null;
};

type Props = {
  items: WeeklyComparisonItem[];
  title?: string;
  subtitle?: string;
  dark?: boolean;
};

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function resolvePlannedKm(item: WeeklyComparisonItem) {
  return safeNumber(item.plannedKm);
}

function resolveActualKm(item: WeeklyComparisonItem) {
  if (typeof item.actualKm === "number") return safeNumber(item.actualKm);
  if (typeof item.executedKm === "number") return safeNumber(item.executedKm);
  if (typeof item.completedKm === "number") return safeNumber(item.completedKm);
  return 0;
}

function resolveAdherencePct(
  item: WeeklyComparisonItem,
  actualKm: number,
  plannedKm: number
) {
  if (
    typeof item.adherencePct === "number" &&
    Number.isFinite(item.adherencePct)
  ) {
    return item.adherencePct;
  }

  if (plannedKm <= 0) return actualKm > 0 ? 100 : 0;
  return (actualKm / plannedKm) * 100;
}

function getProgressPct(actualKm: number, plannedKm: number) {
  if (plannedKm <= 0) return actualKm > 0 ? 100 : 0;
  return Math.min((actualKm / plannedKm) * 100, 100);
}

function parseWeekLabel(label: string) {
  const match = label.match(/^(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})$/);

  if (!match) return null;

  const [, startDayStr, startMonthStr, endDayStr, endMonthStr] = match;

  const startDay = Number(startDayStr);
  const startMonth = Number(startMonthStr);
  const endDay = Number(endDayStr);
  const endMonth = Number(endMonthStr);

  if (
    !Number.isFinite(startDay) ||
    !Number.isFinite(startMonth) ||
    !Number.isFinite(endDay) ||
    !Number.isFinite(endMonth)
  ) {
    return null;
  }

  return {
    startDay,
    startMonth,
    endDay,
    endMonth,
  };
}

function isDateWithinWeekLabel(label: string, now = new Date()) {
  const parsed = parseWeekLabel(label);
  if (!parsed) return false;

  const currentYear = now.getFullYear();

  const start = new Date(
    currentYear,
    parsed.startMonth - 1,
    parsed.startDay,
    0,
    0,
    0,
    0
  );

  let endYear = currentYear;

  if (parsed.endMonth < parsed.startMonth) {
    endYear += 1;
  }

  const end = new Date(
    endYear,
    parsed.endMonth - 1,
    parsed.endDay,
    23,
    59,
    59,
    999
  );

  return now >= start && now <= end;
}

function isCurrent(item: WeeklyComparisonItem) {
  if (item.isCurrentWeek || item.current) return true;
  return isDateWithinWeekLabel(item.label);
}

export default function WeeklyComparisonChart({
  items,
  title = "Planejado x executado por semana",
  subtitle,
  dark = false,
}: Props) {
  return (
    <div style={{ background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.08)" : "none", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: dark ? "#fff" : "#111", marginBottom: 4 }}>{title}</h2>

      {subtitle ? <p style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280", marginTop: 2 }}>{subtitle}</p> : null}

      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(255,255,255,0.25)" : "#9ca3af", marginTop: 8 }}>
        Da semana mais recente para a mais antiga
      </p>

      <div className="mt-5 space-y-5">
        {items.map((item) => {
          const plannedKm = resolvePlannedKm(item);
          const actualKm = resolveActualKm(item);
          const adherencePct = resolveAdherencePct(item, actualKm, plannedKm);
          const progressPct = getProgressPct(actualKm, plannedKm);
          const currentWeek = Boolean(item.isCurrentWeek || isCurrent(item));

          return (
            <div
              key={item.label}
              className={`rounded-2xl border p-4 ${
                currentWeek
                  ? "border-orange-200 bg-orange-50/40"
                  : dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p style={{ fontSize: 14, fontWeight: 600, color: dark ? "#fff" : "#111" }}>
                    {item.label}
                  </p>

                  {currentWeek ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                      Atual
                    </span>
                  ) : null}
                </div>

                <p style={{ fontSize: 12, fontWeight: 500, color: dark ? "rgba(255,255,255,0.6)" : "#374151" }}>
                  {actualKm.toFixed(1)} / {plannedKm.toFixed(1)} km
                </p>
              </div>

              <div className="mt-4">
                <div style={{ marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: dark ? "rgba(255,255,255,0.5)" : "#4b5563" }}>
                  <span>Progresso real</span>
                  <span>
                    {actualKm.toFixed(1)} / {plannedKm.toFixed(1)} km
                  </span>
                </div>

                <div style={{ height: 6, overflow: "hidden", borderRadius: 999, background: dark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}>
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#4b5563" }}>
                  {plannedKm > 0 ? (
                    actualKm >= plannedKm ? (
                      <p>
                        Meta semanal cumprida. Excedente de{" "}
                        {(actualKm - plannedKm).toFixed(1)} km.
                      </p>
                    ) : (
                      <p>
                        Faltam {(plannedKm - actualKm).toFixed(1)} km para cumprir
                        o planejado da semana.
                      </p>
                    )
                  ) : actualKm > 0 ? (
                    <p>Semana sem planejamento definido, mas houve execução.</p>
                  ) : (
                    <p>Semana sem planejamento e sem execução registrada.</p>
                  )}

                  <p className="mt-2">
                    Planejado: {plannedKm.toFixed(1)} km • Executado:{" "}
                    {actualKm.toFixed(1)} km
                  </p>

                  <p className="mt-1">{adherencePct.toFixed(0)}% de aderência</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
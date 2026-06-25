export default function WeeklyPlanLegend() {
  return (
    <div className="weekly-plan-card__legend mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[10px] text-white/40">
      <span className="flex items-center gap-1">
        <i className="weekly-legend-square weekly-legend-square--actual inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" />
        Executado ≥90%
      </span>

      <span className="flex items-center gap-1">
        <i className="weekly-legend-square weekly-legend-square--warning inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" />
        Executado 70–89%
      </span>

      <span className="flex items-center gap-1">
        <i className="weekly-legend-square weekly-legend-square--danger inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
        Executado &lt;70%
      </span>

      <span className="flex items-center gap-1">
        <i className="weekly-legend-square weekly-legend-square--planned inline-block h-2.5 w-2.5 rounded-sm bg-white/25" />
        Planejado
      </span>

      <span className="flex items-center gap-1">
        <i className="weekly-legend-line inline-block h-2 w-3 border-b-2 border-indigo-400" />
        Aderência %
      </span>
    </div>
  );
}

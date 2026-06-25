const STATUS_LEGEND_ITEMS = [
  {
    label: "Feito",
    detail: "80–120% do planejado",
    color: "#86efac",
    background: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.24)",
  },
  {
    label: "Fora da margem",
    detail: "abaixo de 80% ou acima de 120%",
    color: "#fbbf24",
    background: "rgba(245,158,11,0.11)",
    border: "rgba(245,158,11,0.28)",
  },
  {
    label: "Hoje",
    detail: "pendente no dia atual",
    color: "#93c5fd",
    background: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.24)",
  },
  {
    label: "Não feito",
    detail: "treino passado sem corrida",
    color: "#fca5a5",
    background: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.24)",
  },
  {
    label: "Futuro",
    detail: "treino ainda por vir",
    color: "rgba(255,255,255,0.58)",
    background: "rgba(255,255,255,0.045)",
    border: "rgba(255,255,255,0.10)",
  },
];

export default function CorosCalendarLegend() {
  return (
    <div className="coros-calendar-legend">
      {STATUS_LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          style={{
            border: `1px solid ${item.border}`,
            background: item.background,
            borderRadius: 999,
            padding: ".45rem .7rem",
            display: "inline-flex",
            alignItems: "center",
            gap: ".45rem",
            minWidth: 0,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, flex: "0 0 auto" }} />
          <span style={{ color: item.color, fontSize: 11, fontWeight: 800 }}>{item.label}</span>
          <span className="ba-muted" style={{ fontSize: 11 }}>{item.detail}</span>
        </div>
      ))}
    </div>
  );
}
